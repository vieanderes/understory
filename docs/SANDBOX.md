# The code sandbox

Learners type JavaScript, TypeScript, TSX with React, or Python and Understory runs it
against tests, in the browser, with no server. This document says what that code could
try, what stops it, how the pieces talk, and what was found on WebKit. It describes version
1 of the runner, the protocol and the harness. React and Python have their own sections,
"React challenges" and "Python".

The rule behind every choice: learner code is hostile. It may have been pasted from
anywhere, and a lesson link can be shared, so "the learner only attacks themselves" is
not an assumption the design relies on for anything that matters.

## What is protected

1. The app origin: IndexedDB with the learner's progress, `localStorage`, the service
   worker and its caches, and later a sync token.
2. The tab: it must stay responsive whatever the code does.
3. The network: learner code must not be able to send anything anywhere.

The mark itself is not protected. See "Integrity" below.

## The pieces

| Piece          | File                                                        | Role                                                                 |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Port           | `src/core/ports/code-runner.ts`                             | `RunRequest`, `RunResult`, `CodeRunner`, `Transpiler`.               |
| Protocol       | `src/core/running/protocol.ts`                              | zod schemas for every wire message.                                  |
| Limits         | `src/core/running/limits.ts`                                | Every bound, in one place.                                           |
| Harness        | `src/core/running/harness.ts`                               | `test`, `expect`, console capture, `__load`, `__run`, as one string. |
| Shared steps   | `src/core/running/prepare.ts`                               | Request check, transpile, result building. Used by both runners.     |
| Transpiler     | `src/adapters/transpile/sucrase.ts`                         | Types off, modules to script. Loaded on first run.                   |
| Browser runner | `src/adapters/sandbox/iframe-runner.ts`, `frame-session.ts` | The parent side.                                                     |
| Frame script   | `src/adapters/sandbox/frame/frame-main.ts`                  | The broker inside the iframe.                                        |
| Worker source  | `src/adapters/sandbox/frame/worker-source.ts`               | What runs in the Web Worker.                                         |
| Node runner    | `src/adapters/node-runner/worker-runner.ts`                 | The same harness in `worker_threads` plus `vm`.                      |
| CI gate        | `scripts/lib/node-solution-gate.ts`                         | Solution passes, starter does not, two tests or more.                |
| React runtime  | `src/adapters/sandbox/react-runtime/`                       | React, a worker DOM and Testing Library for tsx runs.                |
| Runtime loader | `src/adapters/sandbox/runtime-loader.ts`                    | Fetches the React runtime once per page, for the parent.             |
| Build          | `scripts/build-sandbox.ts`                                  | Writes the runner, the harness and both React runtimes.              |
| React page     | `src/adapters/sandbox/react-playground/`                    | React and react-dom for React playgrounds, inlined in the preview.   |
| Bench          | `src/app/dev/sandbox/`                                      | A plain page for e2e tests and manual checks. Unlinked, noindex.     |
| Python harness | `src/core/running/python-harness.ts`                        | `test`, `describe`, `expect`, print capture, `run`, as one string.   |
| Python, frame  | `src/adapters/sandbox/frame/python-host.ts`                 | The warm Pyodide worker. Its bootstrap: `python-worker-source.ts`.   |
| Python files   | `src/adapters/pyodide/assets.ts`, `scripts/copy-pyodide.ts` | Where Pyodide is served from, and how the parent fetches it.         |
| Python, Node   | `src/adapters/node-runner/pyodide-runner.ts`                | The warm Pyodide worker thread for the CI gate.                      |
| Python imports | `src/core/running/python-packages.ts`                       | Which of numpy, pandas and pydantic a run imports, and their wheels. |
| Python wheels  | `src/adapters/pyodide/wheels.ts`                            | Fetches the pinned wheels once, checks their SHA-256, keeps them.    |
| Type checker   | `src/adapters/typecheck/`, `src/core/typecheck/`            | The TypeScript compiler in a worker, and its verdict on a run.       |
| SQL            | `src/adapters/sql/`, `src/core/sql/`                        | Postgres (PGlite) in a worker, and the verdict on a run.             |

`public/sandbox/runner.v1.html`, `public/sandbox/harness.v1.js` and
`public/sandbox/react-runtime.v1.js` are generated and committed. Run
`pnpm exec tsx scripts/build-sandbox.ts` after changing the harness, the protocol, the
limits, anything under `src/adapters/sandbox/frame/` or `src/adapters/sandbox/react-runtime/`,
or the version of React, linkedom or Testing Library. After any of these, and after a
change to the Python harness, `src/core/playground`, `src/core/sql`, `src/adapters/sql` or
the `sucrase`, `pyodide` or PGlite version, also run
`ios/UnderstoryKit/Scripts/sync-resources.sh`: it writes what the iOS package embeds (the
harness, the React runtime and React page runtime, the Python harness, a Sucrase bundle,
the web's page builder, checks and SQL verdict as `core-kit.v1.js`, the SQL page side and
worker, and the Pyodide, wheel and PGlite checksums, listed in
`ios/UnderstoryKit/Scripts/build-resources.ts`), and `--check` fails when one is stale. A unit test
(`tests/unit/adapters/sandbox/build.test.ts`) fails while the committed files are stale.

## Layers, from the outside in

### 1. The response header

`next.config.ts` serves everything under `/sandbox/` with

```
Content-Security-Policy: sandbox allow-scripts; default-src 'none';
  script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:;
  style-src 'unsafe-inline'; frame-ancestors 'self'
```

- `sandbox allow-scripts` without `allow-same-origin` gives the document an opaque
  origin. This is the wall. An opaque origin has no cookies, no `localStorage`, no
  IndexedDB, no service worker, and is cross-origin to the app, so `parent.document` and
  `top.location` throw. Because the directive is in the header, it holds even when someone
  opens the runner URL as a top-level page and posts code at it, and it travels with the
  copy the service worker keeps, so the frame is just as walled off offline. It is the
  only sandbox on the document: the iframe has no `sandbox` attribute (see "Offline").
- `default-src 'none'` leaves no `connect-src`, `img-src`, `font-src`, `media-src` or
  `frame-src`. Code in the frame, and in workers it creates, cannot fetch, open sockets,
  load images as a side channel or create frames. Workers made from a blob URL inherit
  this policy.
- `script-src 'unsafe-inline' 'unsafe-eval' blob:` is what the page is for: one inline
  script, a blob worker, and `eval` of learner code inside that worker.
- `frame-ancestors 'self'` lets only the app embed the runner. App pages keep
  `frame-ancestors 'none'`.

### 2. The iframe, and a check that fails closed

`IframeRunner` creates a hidden `<iframe>` without a `sandbox` attribute. Version 1 had
`sandbox="allow-scripts"` to repeat the header, but a frame with that attribute is never
handed to the service worker, so it could not load offline ("Offline" below). The header's
directive sets the same flags the attribute did: scripts, and nothing else. No
`allow-same-origin`, no `allow-forms`, no `allow-popups`, no `allow-top-navigation`, so the
frame cannot navigate the tab or open windows.

What the attribute guarded against, a response that lost its header on the way, is now
checked instead, in three places, each failing closed:

1. The parent, on the frame's `load` event: if it can read the frame's document, the
   document shares the app's origin, so the frame is removed and the run ends with
   `SandboxError: The sandbox is not isolated`. No `init`, no port, no code is sent.
2. The frame script refuses `init` unless `window.origin` is `'null'`.
3. The service worker keeps and serves a copy of the runner only when its CSP carries
   exactly `sandbox allow-scripts` (`isStorableSandboxDocument` in `src/sw/strategies.ts`).
   A stripped copy is never cached, and an old one in the cache is never served.

One flag differs in kind: the attribute's flags stay on the browsing context across
navigations, the header's belong to the document. Only the frame script could navigate
the frame (learner code runs in a worker, which has no `location` to set), and every app
page it could reach answers with `frame-ancestors 'none'` except `/sandbox/`, which carries
the directive again.

### 3. The frame script

The frame is a broker. Learner code never runs on its thread. It accepts one `init`, and
only from `window.parent`; opened as a top-level page it has no parent and stays inert.
After that it listens only to the MessagePort. It parses every message from the parent
and from the worker with the protocol schemas and drops what does not fit.

### 4. The worker

Each run gets a new Web Worker from a blob URL. The worker source is one function that:

1. keeps the only reference to `postMessage` and a per-run nonce in its closure,
2. replaces `fetch`, `XMLHttpRequest`, `WebSocket`, `WebSocketStream`, `WebTransport`,
   `EventSource`, `importScripts`, `Worker`, `SharedWorker` and `BroadcastChannel` with
   functions that throw a readable error, and sets `indexedDB`, `caches`, `cookieStore`,
   `navigator.sendBeacon`, `navigator.storage`, `navigator.serviceWorker` and
   `navigator.locks` to `undefined`, on the global and on every prototype that carries
   them, non-writable and non-configurable,
3. evaluates the React runtime when the run is tsx (see "React challenges"), then the
   harness,
4. calls `__load(code, tests)` and `__run()` and posts the report.

Step 2 is defence in depth. The CSP and the opaque origin are the real wall; the stubs
turn a silent CSP block into a message a learner can read, and cover a browser that gets
one of the two wrong. A worker has no `window`, `document`, `parent` or `top` at all.

Learner code and tests are embedded in the worker source with `JSON.stringify`, so they
are string data there and cannot close a quote and become bootstrap code. The harness
evaluates them with indirect `eval`, which runs in the global scope and cannot see the
closure that holds the nonce and `postMessage`.

### 5. The harness

One strict script holds the learner's code followed by the tests, so tests can call the
learner's top-level functions. A syntax error or a throw while loading is caught and
reported with its line instead of killing the host. Tests run in order; a failing or
throwing test does not stop the next one. Console output is capped at 200 lines and
64 KB with one truncation notice. Test count, names and messages are bounded, so the
report always fits the protocol schema.

### 6. The parent

`IframeRunner` parses every message from the port, ignores messages for another `runId`,
applies the log cap again and runs the watchdog described below.

## The protocol

Every message carries `v: 1` and `runId`. Both sides validate with the zod schemas in
`src/core/running/protocol.ts`. Unknown keys are rejected.

| Direction       | Message | Fields                                                               | Notes                                                                                                                                    |
| --------------- | ------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| parent to frame | `init`  |                                                                      | Sent once with `window.postMessage(init, '*', [port])`.                                                                                  |
| frame to parent | `ready` | `harnessVersion`                                                     | First message on the port. Echoes the `runId` of `init`.                                                                                 |
| parent to frame | `run`   | `engine`, `code`, `tests`, `timeoutMs`, `harnessVersion`, `runtime?` | `engine` is `js` or `python`: which worker to start. JavaScript arrives transpiled. A tsx run adds `runtime: { name: 'react', source }`. |
| frame to parent | `log`   | `line`                                                               | Streamed, so output survives a timeout.                                                                                                  |
| frame to parent | `done`  | `status`, `tests`, `logs`, `error?`                                  | Exactly one per run that is not superseded.                                                                                              |

`targetOrigin` is `'*'` because an opaque origin cannot be named. That is safe: `init`
carries no secret and is posted to the window object of the frame the runner has just
created. The parent waits for the iframe's `load` event, sends `init`, and receives
`ready` on the port. It never listens on `window`, so there is no `message` handler a
foreign window could reach and no `event.source` check to get wrong. The frame does
listen on `window` for `init`, and there it checks `event.source === window.parent` and
that its own origin is opaque.

Between worker and frame there are three messages, `started`, `log` and `done`, each
with the nonce. They are validated by `workerMessageSchema`.

Transpiling happens in the parent. Sucrase is loaded with a dynamic `import()` on the
first run, so it is a separate chunk of about 225 KB that a reader who never runs code
does not download. Syntax errors it finds become a `RunResult` with `status: 'error'`
and a line, before any frame or worker is involved.

## React challenges

A code challenge with `language: tsx` is a React component and its Testing Library tests.
It runs through the same frame, worker, harness and limits as any other run. What changes:

1. **Transpile.** Sucrase adds its `jsx` transform with the automatic runtime, so `<p />`
   becomes a call to `jsx` from `'react/jsx-runtime'` and a component needs no
   `import React`. Lines stay where the learner typed them.
2. **Runtime.** `prepareRun` marks the run as needing the `react` runtime. The parent loads
   `/sandbox/react-runtime.v1.js` (`runtime-loader.ts`, once per page) and sends its text in
   the `run` message. The frame cannot fetch it: its origin is opaque and its CSP is
   `default-src 'none'`. The worker evaluates the runtime with indirect eval, as a global
   script, after the network and storage APIs are blocked and before the harness. The Node
   runner evaluates the same committed file with `vm.runInContext` at the same point.
3. **Separate scopes.** Code and tests are two modules. Each transpiled file declares
   helper names such as `_react`, and in one shared scope the tests' `_react` (Testing
   Library) would replace the code's (React). So a tsx run calls
   `__load(code, tests, { separateScopes: true })`, which wraps each in its own function
   scope on the same lines. Tests reach the component through `import ... from './solution'`.
4. **Harness host hooks.** The runtime sets three globals the harness takes and removes:
   `__hostModules` (what `'react'`, `'react-dom/client'`, `'react/jsx-runtime'`,
   `'@testing-library/react'`, `'@testing-library/dom'` and `'@testing-library/user-event'`
   resolve to), `__hostMatchers` (jest-dom style matchers) and `__hostAfterEach` (unmounts
   and empties the page after every test). The harness itself stays free of any DOM.

What the runtime holds (`src/adapters/sandbox/react-runtime/`):

| File            | Role                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `install.ts`    | Runs first. Installs the DOM before react-dom is evaluated, fixes `navigator` and `location`, collects errors React reports through `reportError`. |
| `dom.ts`        | linkedom plus focus and `activeElement`, form state as properties, `select.options`, `label.control`, `requestSubmit`, `getComputedStyle`.         |
| `events.ts`     | Event classes and a dispatch with capture, target and bubble phases, and click activation (checkboxes, radios, labels, submit buttons).            |
| `user-event.ts` | `userEvent` with the call shapes of user-event 14: click, type with `{Key}` syntax, keyboard, tab, clear, hover, selectOptions.                    |
| `matchers.ts`   | `toBeInTheDocument`, `toHaveTextContent`, `toHaveAttribute`, `toHaveValue`, `toHaveFocus`, `toBeVisible` and the rest.                             |
| `runtime.ts`    | Wires React 19, react-dom, Testing Library and the above into the host hooks, and puts `render`, `screen` and `userEvent` on the global object.    |
| `polyfills.ts`  | Injected by esbuild for globals a worker has and a `vm` context lacks (`atob`), so both run the same code.                                         |

Choices, and why:

- **React's development build.** It is the only build with `act`, and it prints the
  warnings a learner should see ("Each child in a list should have a unique key"). The
  harness console fills `%s` placeholders, as browsers do, so the warnings read well, and it
  offers every standard console method, because React probes `console.timeStamp` at load.
- **linkedom, not jsdom or happy-dom.** jsdom is too large for a worker and happy-dom
  imports Node built-ins (`vm`, `http`, `zlib`) that do not bundle for a browser. linkedom is
  plain JavaScript. What it lacks is filled in `dom.ts` and `events.ts`, and its
  unregistered element classes (`label`, `form`, `li` and others) are attached on creation.
- **Our own user-event.** The real library drives selection ranges, clipboard and pointer
  state the worker DOM does not model. The subset plays the events in browser order with
  the default actions tests rely on, and every dispatch goes through Testing Library's
  `eventWrapper`, which React Testing Library sets to `act`.
- **Errors in handlers fail the test.** React 19 passes an error thrown in an event handler
  to `reportError`. A worker would make that an uncaught error and the Node `vm` context has
  no `reportError`, so the runtime collects the error, and `render`, `fireEvent` and every
  `userEvent` step rethrow it: the test that clicked fails with the handler's message, the
  same in both runtimes.

Limits a lesson author must know:

- No layout and no style sheets. `getComputedStyle` answers `display` and `visibility`
  from `hidden` and inline styles only; sizes and positions are zero.
- Sucrase does not check that JSX closing tags match. A mismatch is a `SyntaxError`, but
  its line can be earlier than the mistake, and `<span></b>` may even compile.
- Canvas, media and observer callbacks are missing or inert. `FormData` (read from the worker DOM's form fields, so React form actions work), `MessageChannel` (for `await act(async () => ...)`) and a no-op `performance` clock are provided by the runtime, the same in the browser worker and the Node gate.

### On iOS

`JavaScriptRunner` in `ios/UnderstoryKit` runs tsx on JavaScriptCore with the same
committed `react-runtime.v1.js`, in the order the browser worker and the Node gate use:
host shims, then the runtime as a global script, then the harness, then
`__load(code, tests, { separateScopes: true })`. The fixture above passes and its starter
fails with the same messages (`ReactRunnerTests`).

- **Transpile.** `SucraseTranspiler` runs the web's installed Sucrase (3.35.1), bundled by
  `build-resources.ts` into `sucrase.v1.js` (289 KB), in a plain `JSContext`, with the
  options of `src/adapters/transpile/sucrase.ts`. A syntax error maps as `prepareRun`
  maps it: `SyntaxError` with `line` for the learner's code, `(tests, line N)` in the text
  for the tests. It also makes `ts` runnable on iOS, which the passthrough refused.
- **Shims.** A `JSContext` has none of a worker's globals. `HostShims` adds what the Node
  gate hands its `vm` context: `setTimeout`, `clearTimeout`, `setInterval`,
  `clearInterval` and `queueMicrotask`. The timers are real: the run's thread drives an
  event loop that sleeps until the next timer is due and calls it as a new outermost call,
  so promise jobs drain between callbacks as in a browser. React's scheduler finds no
  `MessageChannel` or `setImmediate` and uses its `setTimeout` branch. The runtime brings
  its own `atob`; nothing needed `TextEncoder`. js and ts runs get the same timers, as
  they do on the web.
- **Not mirrored.** `structuredClone` is absent. An unhandled rejection outside any test
  ends a run on the web and in the Node gate; JavaScriptCore reports those only through a
  private hook, so on iOS the run goes on to its report. A test that waits on a promise
  nothing settles is a timeout, as on the web, but reported as soon as no timer is left.
- **Timeouts.** The JavaScriptCore watchdog (private API, docs/ios/PLAN.md D9) restarts
  its clock on every entry into the VM, so the event loop re-arms it before each timer
  callback with what is left of the run's budget. A component that renders for ever and a
  loop inside a timer callback are both stopped by the watchdog. It counts CPU time, so
  the runner tests run one at a time (`RunnerSuite`): in parallel, a starved spinning
  thread can lose the race against the host's wall-clock deadline.
- **Numbers**, `swift test` on Apple silicon, macOS 26: loading Sucrase 55 ms once per
  process; the fixture's four-test run 120 to 170 ms, a fresh VM and the 963 KB runtime
  evaluated on every run; a small js run 4 ms. The whole runner suite also passes on the
  iOS 26.2 simulator through `xcodebuild test` (Sucrase 29 ms, the fixture 110 to 300 ms),
  but the simulator runs on the Mac's CPU with a JIT. On a device JavaScriptCore has none,
  so expect slower runs there; not yet measured on hardware.

### Spike measurements (September 2026)

Measured with the fixture in `tests/fixtures/react-challenge/` (an accessible autocomplete,
four tests with typing, arrow keys, Enter and Escape) on the production build, through the
bench page, with Playwright Chromium (desktop) and WebKit (iPhone 15 profile).
`tests/e2e/sandbox.spec.ts` prints the numbers on every run.

| Gate                           | Budget         | Measured                                                                                                                                                                           |
| ------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extra transfer for a tsx run   | 1.5 MB gzipped | 298,830 bytes gzipped over the wire (963 KB minified), once per page. Minified: react-dom 390 KB, entities 114 KB, aria-query 102 KB, linkedom 58 KB, Testing Library 41 KB.       |
| Small component run, warm      | under 1 s      | Chromium 190 to 280 ms, WebKit 160 to 220 ms for the four-test run, worker start and runtime evaluation included. The first tsx run on a page, download included: 340 to 1,000 ms. |
| Works offline once cached      | yes            | The service worker keeps the runtime after the first fetch (static cache, stale-while-revalidate) and answers it with the network cut in Chromium. See "Offline" below.            |
| Deterministic in the Node gate | same verdict   | 20 runs alternating solution and starter gave exactly two distinct results. A Node run takes 140 to 300 ms. The gate evaluates the committed bundle, the same bytes.               |

Decision: the gate passed, and tsx challenges are implemented as described above.

Offline: tsx runs work offline once the runtime has been fetched once, as js, ts and
Python do (see "Offline"). The React runtime adds no gap of its own: the app page fetches
it, and the service worker controls that page.

## Type checking

A `ts` challenge is type-checked as well as run (docs/CONTENT-GUIDE.md, "Type checking").
Stripping the types and running the tests, which is all the runner does, never showed a
learner a type error; for a TypeScript lesson the checker is the point.

| Piece       | File                                       | Role                                                                    |
| ----------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Port        | `src/core/ports/type-checker.ts`           | `TypeChecker`, `TypeDiagnostic`, `TypeCheckOutcome`.                    |
| Options     | `src/core/typecheck/options.ts`            | The compiler options, the file names, the sandbox globals.              |
| Diagnostics | `src/core/typecheck/diagnostics.ts`        | The learner's errors only, in order, each with a visible range.         |
| Verdict     | `src/core/typecheck/verdict.ts`            | `typecheckOf` (which steps) and `withTypeCheck` (the run plus a check). |
| Program     | `src/adapters/typecheck/program.ts`        | One compiler program, shared by the worker and Node.                    |
| Worker      | `src/adapters/typecheck/worker.ts`         | Bundled with the compiler by `scripts/build-typecheck.ts`.              |
| Page side   | `src/adapters/typecheck/worker-checker.ts` | Starts the worker, matches replies, never rejects.                      |
| Editor      | `src/features/editor/typecheck/`           | Lint underlines, the caret tooltip, the list, one shared worker.        |
| Gate        | `scripts/lib/node-solution-gate.ts`        | The solution and the starter, with the same program in Node.            |

**The program.** The learner's file is `/solution.ts`, the tests `/tests.ts`, beside
`content/harness.d.ts` and a small declaration of what the sandbox adds to the language
(`console`, timers, `queueMicrotask`, `structuredClone`). Every relative import resolves to
the learner's file, as the harness's `require` does, so `'./fare.solution'` works. A package
import resolves to nothing and is an error, as it is at run time. The options are
`tsconfig.content.json`'s (strict, `noUncheckedIndexedAccess`, ES2023, no DOM, since the
worker that runs the code has none) plus `moduleDetection: force`, so a top-level `name`
never meets a global. A unit test keeps the two in step. Only the learner's file is
reported: an error in the tests is the author's, and the gate prevents it.

**The worker.** The compiler is 3.5 MB minified, so it lives in its own classic worker,
`public/typescript/checker.<hash>.js` (4.4 MB with the ES2023 library files, 1.1 MB
gzipped), with `checker.json` naming it. Both are built by `pnpm build:typecheck` before
`dev` and `build`, and git-ignored. The page reads the manifest and starts the worker only
when a type-checked step is on screen; one worker serves every editor on the page and is
closed a minute after the last one goes. The compiler reads learner code and never runs
it, so it needs none of the runner's walls: it is a same-origin worker under the app's CSP
(`worker-src 'self'`, no `'unsafe-eval'`, which TypeScript does not use). The first check
parses the library, a few hundred milliseconds; later checks take a few milliseconds.

**In the editor.** `CodeEditor` loads the checker's client in a chunk of its own
(`TypecheckLayer`), so neither the lesson route nor a JavaScript step pays for it
(tests/e2e/bundle-budget.spec.ts). It is a `@codemirror/lint` source that runs 400 ms after
typing stops. Each error is a red wavy underline, a tooltip with the compiler's message on
hover, a second tooltip while the caret is inside the error (a keyboard user and a tap on a
phone put it there), and a row in the list under the editor: `Line 4` as a button that puts
the caret on the error, and the message. The list's status line ("2 type errors") is a live
region. Positions follow edits, so the line numbers stay true while the learner types.

**The verdict.** Run tests starts a check of the same code beside the run. `withTypeCheck`
puts "Type errors", failed, with the first five messages, or "No type errors", passed, in
front of the tests, and turns a passing run into a failing one when there are errors. When
the checker is not available (offline before it was ever fetched, a failed download, a
checker that stopped answering) the run stands as it was and the list says types are not
checked: a failed download never blocks a learner.

**The gate.** For a type-checked step the gate also requires a clean solution and a clean
starter, or, with `expectStarterTypeError`, a starter with a type error, which may then pass
the tests. `tsconfig.content.json` leaves starters to the gate for that reason. The Node
program reads the library files from `node_modules/typescript` and checks a challenge in
about 5 ms.

**Offline.** The service worker keeps `checker.<hash>.js` cache-first in
`understory-typescript-v1` after the first TypeScript step, like Pyodide, and revalidates
`checker.json`. It is not precached, because most visits never reach a TypeScript step.
The hash in the name means a cached copy is never served for another build.

**Not yet.** tsx steps are not checked: that needs React's and the DOM's types in the
worker, about 2 MB more. iOS has no checker yet: it grades on the tests alone, as the web
does when its checker is not available, and `StepRuntime.typesChecked` is false so the step
says types are not checked. Assessments
score hidden tests only and do not show the checker.

## Termination

Two layers, plus the limits.

1. The frame starts a timer of `timeoutMs` when it creates the worker. When it fires the
   frame calls `worker.terminate()`, which stops a synchronous `while (true) {}`, revokes
   the blob URL and sends `done` with `status: 'timeout'` and the logs streamed so far.
2. The parent starts a watchdog of `timeoutMs + 1500 ms`. If no valid `done` arrives it
   removes the iframe, which destroys the worker with it, resolves with `timeout`, and
   creates a fresh frame on the next run. This covers a wedged or subverted frame. The
   e2e suite proves it with a stand-in runner that completes the handshake and then
   answers `run` with garbage.

One run at a time. A new `run` terminates the previous worker, and the older promise
rejects with an `AbortError`. Aborting through the signal removes the frame, because that
is the one sure way to stop a worker that may be mid-loop. `dispose()` removes the frame,
closes the ports and rejects a live run.

`timeoutMs` must be between 100 and 30 000. Code and tests are limited to 256 KB each.

## Playground

The `playground` step (src/core/playground, src/features/playground) shows a learner's
HTML, CSS and JavaScript as a live page. It does not use the runner above: a page must be
drawn, not tested in a worker, so it gets its own, smaller design.

- **The frame.** An `<iframe sandbox="allow-scripts" srcdoc="…">`, rebuilt 250 ms after the
  last keystroke. `sandbox` without `allow-same-origin` gives the page an opaque origin, so
  learner code cannot reach the app's storage, cookies or DOM. `srcdoc` fetches nothing, so
  the preview works offline with no service-worker entry. It inherits the app's CSP (the
  reason the runner avoids `srcdoc`), which here only narrows what the page may do.
- **The page's own policy.** `buildPlaygroundDocument` puts a CSP `<meta>` first in the head:
  `default-src 'none'`, images, media and fonts from `data:` and `blob:` only, no base, no
  form action. Scripts: `'unsafe-inline'` only when the step has `js`; otherwise only the
  probe runs, by nonce, so a `<script>` or `onclick` typed into the HTML does nothing. No
  request of any kind leaves the page.
- **What the playground adds** carries `data-understory`: the policy, the probe, a
  zero-specificity `:where(html)` rule that paints the browser's `Canvas` ground (the frame
  is a web page in both themes), the CSS tab as a `<style>` and the JavaScript tab as a
  `<script>` after the HTML. The probe leaves these out of checks and of the DOM tree.
  `</style` and `</script` in the sources are escaped, and the checks are embedded as JSON
  with `<` escaped.
- **The probe** (`probe.ts`) is source text, like the harness: one function that gathers
  facts for each check (match count, first match's text, attribute and computed style) and
  the element tree (at most 200 rows, text shortened). The frame script calls it on `load`
  and again, debounced, on every DOM mutation, collects script errors with the learner's
  line number, stops links and forms from navigating the frame, and posts
  `{ source, nonce, report }` to the parent.
- **The parent** accepts a message only when `event.source` is its own frame and the nonce
  is the current document's, and parses it with `playgroundMessageSchema`. Judging the facts
  is `evaluateChecks` in core, shared with the gate. The report reaches React through an
  external store (`preview-store.ts`) read with `useSyncExternalStore`.
- **The gate** (`scripts/lib/playground-gate.ts`) builds the same document and evaluates
  the same probe in jsdom 30, which resolves the cascade, computed colours and lengths in
  px. It has no layout, so layout results cannot be checked there. jsdom rather than
  Chromium, because the gate runs on every `pnpm validate:content`, in a second, with no
  browser download. Scripts run in jsdom only when the step has `js`, as in the browser.
- **Integrity** is as below: learner JavaScript can post a forged report. Only the mark
  suffers.
- **Termination.** A page script that never returns freezes the frame. With site isolation
  an opaque-origin frame usually has its own process; where it does not, the tab can hang
  until the learner edits the code. Beginner playgrounds run tiny scripts; a guard like the
  runner's worker is the next step if loops ever appear in a playground.

### React in the playground

A playground with `jsx` renders a React component (src/core/playground/react-page.ts). What it
adds to the design above:

- **The runtime.** `public/sandbox/react-playground.v1.js` is React 19 and react-dom,
  development build, minified: 420 KB, 127 KB gzip. Built from
  `src/adapters/sandbox/react-playground/runtime.ts` by `scripts/build-sandbox.ts`,
  committed, and checked for staleness by `build.test.ts`. The development build on purpose:
  its errors are sentences, not numbered codes, and it warns about missing keys.
- **Loading.** The parent fetches the file once per page (`runtime-loader.ts`,
  `loadPlaygroundReact`) and sucrase as a lazy chunk (`features/playground/react-kit.ts`, an
  external store), only when a React playground mounts. Neither is on the lesson route. The
  service worker caches `/sandbox/*` on first use, so a React playground renders offline
  after one online visit.
- **The page.** Still `srcdoc`, `sandbox="allow-scripts"`, opaque origin and the page's own
  `default-src 'none'`: nothing is fetched from inside the frame. The runtime text and the
  learner's transpiled module are inlined as scripts (`</script` and `<!--` escaped), after a
  `<div id="root">` unless the HTML has one. Scripts are `'unsafe-inline'`, as for `js`. The
  app CSP the frame inherits has no `'unsafe-eval'`, so nothing is evaluated from a string:
  the module is a function in a script element, and `require` hands out only `react`,
  `react-dom`, `react-dom/client` and `react/jsx-runtime`.
- **The frame script** mounts the default export with `createRoot` and `flushSync`. For the
  checks it renders afresh per check with actions, plays the clicks and typing
  (`actions.ts`, source text like the probe), waits two tasks after each step for React to
  commit, gathers facts, then mounts once more for the learner. Check renders sit under an
  `opacity: 0` rule on `#root`, so only the last render is seen. Errors come from
  `onUncaughtError`, window `error` events and module evaluation; a stack frame inside the
  learner's module is mapped to their line. `console.error` and `console.warn` are recorded
  as warnings.
- **Typing** uses the prototype's `value` setter and an `input` event, as Testing Library
  does, because React ignores a value it set itself.
- **The gate** loads the same page into jsdom with scripts on, waits for the frame
  script's message (10 s limit) and judges the same facts. jsdom's stacks carry no page
  lines, so line numbers are checked in the e2e suite instead. A solution React warns
  about fails the gate.
- **Security** is the playground's: learner code runs in an opaque origin with no network
  and cannot reach the app. It can forge its own report, which only changes its mark. A
  render loop freezes the frame until the next edit, as a looping script does.

### Playgrounds on iOS

`PlaygroundPreview` in `ios/UnderstoryKit` shows the page in a `WKWebView` the app puts on
screen, and judges it with the web's own code: `core-kit.v1.js` is
`buildPlaygroundDocument`, `parsePlaygroundMessage`, `evaluateChecks` and
`gradePlayground` from src/core, bundled by `build-resources.ts` and called through
JavaScriptCore (`CoreKit`). So the document, the probe, the check reasons and the grade are
the browser's bytes, and WebKit draws the page, computed styles and layout included.

- **React.** The component is transpiled by the same Sucrase as a tsx challenge
  (`ComponentModule.compile`, the web's `compileComponent`), and `react-playground.v1.js`,
  the web's committed runtime, is inlined as on the web.
- **Serving.** The page comes from `understory-playground://preview/<nonce>.html`, from
  memory, with `Content-Security-Policy: sandbox allow-scripts allow-same-origin` (no forms,
  pop-ups, dialogs or top navigation, as the iframe's attribute gives) and the document's
  own `default-src 'none'`. Not an opaque origin: WebKit reports every error of a script
  in a sandboxed opaque document as "Script error.", with no message and no line. The origin
  holds nothing else, and each web view has its own non-persistent data store, so storage
  works there and is forgotten with the view; in the browser frame it throws.
- **Walls.** The content rule list of the Python web view blocks http, https, ws and wss; a
  navigation away from the page is cancelled. The probe's `postMessage` to its parent (the
  page itself, at the top level) is forwarded by a user script in its own content world,
  whose message handler the learner's scripts cannot see, and parsed with the web's schema
  under the current nonce.
- **Settling.** A render resolves on the page's first report. Judging waits until the page
  has gone quiet (no report for 300 ms, at most 3 s), because a script that answers from a
  timer changes the page after load, and the web judges what the page shows when Check is
  pressed. The bundle has one such step (`cancel-stale`), and it passes only this way.
- **A page that never answers**, a script that loops for ever, is abandoned after 10 s plus
  2 s per click and keystroke the checks play: the web view, and with it its content
  process, is replaced, and `onReplace` hands the app the new one. Each web view has its
  own data store, so the new one never shares the stuck process. The browser cannot do that
  for a frame.
- **Off screen**, WebKit stretches a page's nested timers to about a second, and a React
  check waits two timer turns per click and keystroke, so judging off screen takes seconds.
  `inactiveSchedulingPolicy = .none` stops the process from being suspended; the page's own
  visibility is WebKit's. In the app the preview is on screen while the learner edits.
- **Proof.** `PlaygroundPreviewTests` draw every scored playground of the built bundle
  (94) in WebKit: each solution passes every check with no script error and each starter
  does not, the gate's two rules. Plus computed styles, a script error's line, later
  reports, React clicks and typing, a compile error, the walls, and a runaway page.

## SQL

A `sql` step (docs/CONTENT-GUIDE.md, "SQL steps") runs the learner's SQL on a real
Postgres: PGlite 0.5.8, Postgres 18.3 compiled to WebAssembly, with its own single-user
backend and an in-memory file system. It does not use the runner above: SQL is not
JavaScript, and nothing the learner types is ever evaluated as JavaScript.

| Piece     | File                                    | Role                                                                   |
| --------- | --------------------------------------- | ---------------------------------------------------------------------- |
| Port      | `src/core/ports/sql-engine.ts`          | `SqlEngine`: a run request in, a report out, never a rejection.        |
| Split     | `src/core/sql/split.ts`                 | Statements as psql splits them: strings, `$$` bodies, comments.        |
| Verdict   | `src/core/sql/verdict.ts`, `compare.ts` | The learner's result against the solution's; `gradeSql` in `grade.ts`. |
| Protocol  | `src/core/sql/protocol.ts`, `limits.ts` | zod schemas for every message; every bound in one place.               |
| Session   | `src/adapters/sql/session.ts`           | Reset, setup, statements one by one, the schema. Shared by both.       |
| Worker    | `src/adapters/sql/worker.ts`            | Bundled by `scripts/build-sql.ts` into `public/sql/0.5.8/`.            |
| Page side | `src/adapters/sql/worker-engine.ts`     | Starts the worker, one run at a time, budgets, never rejects.          |
| Gate      | `scripts/lib/sql-gate.ts`, `node.ts`    | The same session on the same PGlite in Node.                           |
| Step      | `src/features/sql/`, `SqlStep.tsx`      | Editor, Run, result tables, schema panel, one worker per page.         |

**Why a same-origin worker.** PGlite runs SQL, and Postgres built for WebAssembly has no
network, no shell, no `COPY ... PROGRAM` and no file outside its own memory; no extension
is loaded but `plpgsql`. Nothing a learner types can reach JavaScript. So, like the type
checker, it is a plain module worker on the app's origin, not a frame with an opaque
origin, and needs none of the runner's walls. It gets a policy of its own, since a
dedicated worker takes the CSP of its own response: `/sql/` is served with
`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`
(next.config.ts). `'wasm-unsafe-eval'` allows compiling WebAssembly and nothing else; the
app's pages do not get it. Once Postgres has started, the worker replaces `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource` and `importScripts` with functions that throw,
so even a bug in PGlite could not send anything. Checked in Chromium and WebKit
(tests/e2e/sql.spec.ts).

**A run.** Each run starts from a clean database: roll back whatever transaction the last
run left, `DISCARD ALL`, drop every schema but the system ones, every event trigger and
every role the learner made, create `public` again, set UTC, ISO dates and the default
interval style, then run the step's setup. A fresh PGlite per run would cost initdb, about
2 s, and a clone about 0.6 s; the reset takes a few milliseconds. What it cannot undo, such
as a change to a catalog table, lasts until the worker is replaced and harms only that
learner. The learner's SQL is split and each statement runs on its own, so each has its
own result or error, as in psql; the run stops at the first error (`ON_ERROR_STOP`).
Values come back as Postgres's text output for every type: the worker hands PGlite a
parser per type in `pg_type` that returns the text unchanged. Results keep 500 rows and
2,000 characters a value; the count says how many rows there were.

**Judging.** With checks, the page runs the solution on the same fresh database once per
step and compares the last result of each (or of `checks.query`, run after both) with
`compareResultSets`: the same column names in order, the same rows as a multiset, in order
only with `ordered: true`. The feedback names the most basic difference first: the
columns, the row count, then the first missing and the first extra row. The gate runs the
same session and the same comparison in Node, so a verdict there is the one a learner
gets.

**Timeouts.** PGlite runs on the worker's one thread and its `statement_timeout` does not
fire, so the page is the clock. It gives a start 90 s on top of the run's own 5 s: the
worker says `ready` once Postgres is up, and from then on a run gets 5 s. A run past its
budget ends as `timeout`, the worker is terminated, and the next run starts a new one. A
worker that fails to load or to start Postgres ends the run as `unavailable`, and the step
says the database is not available; learning goes on.

**Files and numbers.** `pnpm build:sql` (before `dev` and `build`) copies `pglite.wasm`
(10.1 MB), `pglite.data` (6.3 MB, the Postgres share directory) and `initdb.wasm`
(0.4 MB) from `node_modules/@electric-sql/pglite` into `public/sql/0.5.8/`, bundles the
worker next to them as `engine.<hash>.js` (1 MB), because PGlite fetches its files
relative to its own URL, and writes `public/sql/engine.json` naming it. Together about
5.6 MB compressed, fetched on the first sql step and never before: the lesson route and the
editor chunk do not change (bundle-budget.spec.ts). Measured on the production build,
Apple silicon, Playwright:

|                                                | Chromium  | WebKit (iPhone 15) |
| ---------------------------------------------- | --------- | ------------------ |
| First start: download, compile, initdb, tables | 1.9 s     | 1.8 s              |
| Start again on a new page, files cached        | 1.4 s     | 1.9 s              |
| A run: reset, setup, the learner's SQL         | 60–120 ms | 95–120 ms          |

In Node the gate starts PGlite in 2.5 to 3 s, once per `validate:content`, and a step takes
a few milliseconds.

**Offline.** The service worker keeps `/sql/<version>/*` cache-first in
`understory-sql-v1` after the first sql step, like Pyodide, and revalidates
`/sql/engine.json`. Nothing is precached. `tests/e2e/sql.spec.ts` runs a step online, cuts
the network, reloads and runs it again in Chromium.

**Not yet.** One session at a time: PGlite is single-user, so two transactions cannot race
(the isolation and locking labs stay simulators). Assessments do not use sql steps.

### SQL on iOS

`SqlRunner` in `ios/UnderstoryKit` runs the browser's engine in a hidden `WKWebView`, for
Pyodide's reason: PGlite is WebAssembly, which needs the JIT of WebKit's content process.
Nothing is ported. `sql-engine.v1.js` is `buildEngine()` of scripts/build-sql.ts, the same
module worker; `sql-host.v1.js` is `WorkerSqlEngine`, the same page side with the same
budgets; the verdict and grade are `sqlVerdict` and `gradeSql` through `CoreKit`. The app
runs the solution once per step on the same fresh database and compares, as the step does
on the web, and records no grade for `unavailable`, as the web submits none.

- **Serving.** `understory-sql://sql/` serves the page, `host.js`, `engine.js` with the
  web's `/sql/` policy (`script-src 'self' 'wasm-unsafe-eval'`) and PGlite's three files;
  the worker fetches them relative to itself, as in the browser. The network rule list,
  the non-persistent store and the worker's own network lock-down all apply.
- **Files.** The worker (1 MB) ships in the app. `pglite.wasm`, `pglite.data` and
  `initdb.wasm` (16.8 MB raw, about 5.4 MB compressed) do not: `PGliteAssetStore` fetches
  them on the first sql step from the web app's `/sql/0.5.8/` or any folder with the same
  bytes, and checks each against `pglite.v1.json` (size and SHA-256 from the installed
  package), as the Pyodide store does.
- **Numbers**, `swift test` on Apple silicon, macOS 26, files on disk: first run (web
  view, worker, Postgres start, setup, SQL) 2.2 s; a warm run about 10 ms; a statement past
  its 5 s budget ends as `timeout`, and the next run starts a new worker.
- **Proof.** `SqlRunnerTests` run text values, a line-numbered error that stops the run,
  a judged step, a timeout, and every scored sql step of the built bundle (the solution
  matches, the starter does not, the gate's rules).

## Integrity

Not a goal. Learner code and tests share one scope by design, so the code can shadow
`expect`, register its own passing tests or throw away the real ones. Grading is local
and there is no leaderboard, so the only person this cheats is the learner. The nonce
and the hidden `postMessage` make a forged `done` awkward, no more. If marks ever count
for something, the tests must run somewhere the learner does not control.

## WebKit findings

Checked with Playwright WebKit (the `mobile` project, iPhone 15 profile) against the
production server, first with a probe page and then with the e2e suite.

- A Web Worker from a blob URL works inside a frame that is sandboxed by both the
  `sandbox` attribute and the `sandbox` CSP directive, with an opaque origin, including
  when the iframe is `hidden`. No fallback was needed. Chromium behaves the same.
- The worker reports `self.origin === 'null'`, and `eval` works in it under
  `'unsafe-eval'` from the inherited CSP.
- `worker.terminate()` stops a synchronous infinite loop at once in both engines.
- A `data:` URL worker is refused by `worker-src blob:` in both engines. That is wanted.
  Had blob workers failed, the fallback would have needed `data:` in `worker-src`.
- `indexedDB` exists as an object in the worker of an opaque origin in both engines,
  even though opening a database fails. The worker bootstrap removes it.
- `fetch('/')` fails before CSP is consulted, because a blob worker has no base URL to
  resolve a relative address against. An absolute URL is blocked by CSP. The e2e test
  tries both and also asserts that the server saw no request.
- JavaScriptCore ignores `//# sourceURL` for eval code. Frames of such code appear in
  `error.stack` as `name@` with no URL, and the position is in `error.line`. For a syntax
  error inside `eval`, `error.line` points at the caller of `eval` instead, which would
  mislead. The harness therefore trusts `error.line` only when the innermost stack frame
  has no URL. Result: runtime errors carry a line on WebKit; a syntax error that Sucrase
  lets through (a duplicate `let`, for example) is reported without one. Sucrase catches
  ordinary syntax errors first, with a line, in every browser.

The main-thread fallback described in the milestone brief was not built, because nothing
needed it.

## How the Node gate mirrors the browser

`NodeWorkerRunner` gives the CI gate the same verdict the learner will see.

|                                   | Browser                               | Node                                                          |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Harness                           | `HARNESS_V1`, inlined in the runner   | `HARNESS_V1`, passed as `workerData`                          |
| Transpiler                        | Sucrase, same options                 | Sucrase, same options                                         |
| Request check and result building | `prepare.ts`                          | `prepare.ts`                                                  |
| Isolation unit                    | Web Worker                            | `worker_threads` Worker, fresh `vm` context                   |
| Kill                              | `worker.terminate()`                  | `worker.terminate()`                                          |
| Memory                            | The browser's per-worker limits       | `resourceLimits`: 128 MB old space, 32 MB young, 4 MB stack   |
| Globals for the code              | Worker globals minus the blocked list | ES built-ins plus timers, `queueMicrotask`, `structuredClone` |
| React runtime (tsx)               | Indirect eval of the file's text      | `vm.runInContext` of the committed file, same point           |

Two behaviours are aligned on purpose. A test that awaits a promise nobody settles is a
`timeout` in both: the Node worker holds its event loop open so that it does not simply
exit. An unhandled promise rejection during a run is an `error` in both: Node ends the
thread, and the browser worker listens for `unhandledrejection` and does the same.

Differences that remain: Node compiles the code once with `vm.Script` before running it,
to recover the line of a syntax error that `eval` would hide; lesson code that uses a
browser-only global (`TextEncoder`, `URL`, `crypto`) works in the browser and fails the
gate. Keep lesson code to the language itself.

The `vm` context is not a security boundary, and the Node runner must never run learner
input. It runs lesson content that went through review. The worker gets an empty `env`
and no inherited `execArgv`, and its stdout and stderr are not forwarded.

The gate (`scripts/lib/node-solution-gate.ts`) reports an issue with rule
`solution-gate` when the reference solution does not pass, when the starter passes
(failed, error and timeout all count as not passing), or when fewer than two tests are
registered. It runs at most four workers at a time, so a large catalogue does not time
out honest solutions by starving them of a core. Wire it with
`checkContent(root, nodeSolutionGate)`.

## Modules in learner code

Sucrase's `imports` transform rewrites module syntax to CommonJS. `export function add`
stays a top-level `function add` and gains `exports.add = add`; `export default` becomes
`exports.default`. The harness provides `exports`, `module` and a `require` that returns
the learner's exports for a relative specifier and throws for anything else. So tests
may use the learner's names directly or write `import { add } from './solution'`.
A parser does this work, not a regular expression, so the word `export` inside a string
or a template is left alone. Code runs in strict mode, as a module would.

## Assessment scoring

An assessment (docs/CONTENT-GUIDE.md, "Assessments") scores every hidden test in its own
run, so a slow test costs only its own verdict and a performance test gets its own time
budget. The protocol did not change for this. `src/core/assessment/evaluate.ts` puts a
short preamble in front of the test source that wraps the harness's global `test` (and
`it`): with `__only = -1` it registers every test with an empty body, which lists the names
without running learner code; with `__only = n` it registers only the n-th call. The
browser and the Node gate run the same function, so the gate's verdict on a reference
solution and a brute force is the one a learner sees.

Each run starts a fresh worker, about 30 to 100 ms, so a task with fifteen tests scores in
one or two seconds.

## Online-test cases

The simulator (docs/ONLINE-TEST.md) runs one case per sandbox run through the ordinary
harness. `src/core/online-test/program.ts` writes a single `test` that builds the
arguments (literal JSON, or `__ot_gen(seed, specs)` for a large input), times only the
`solution()` call and throws a marked report: the canonical JSON's hash, its first 600
characters, the time and the input size. The report travels as the failure message, the one
channel learner output cannot crowd out. The verdict is decided outside the sandbox by
comparing hashes, so no hidden expected value is ever written next to learner code. The
runner's budget is the limit plus slack for building the input; the limit is judged against
the timed call alone. The JS and Python generators are tested against the TypeScript
reference in `tests/unit/adapters/online-test/program.test.ts`.

## Python

Python challenges run CPython in WebAssembly: Pyodide 0.29.5, which is CPython 3.13.2. The standard library is there, and three packages load on the first
run that imports them: NumPy, pandas and Pydantic ("Packages"). A test may be an
`async def` ("Async tests").

### Numbers

Measured on 23 September 2026, Apple silicon, `next dev`, Chromium and WebKit through
Playwright, and Node 24 for the gate.

|                                              | Browser                | Node gate              |
| -------------------------------------------- | ---------------------- | ---------------------- |
| Files, raw                                   | 13.2 MB (wasm 10.1 MB) | read from disk         |
| Files, gzip                                  | about 5.7 MB           |                        |
| First Python run: download, start, run       | 2.9 s                  | 1.2 to 2.4 s           |
| First run of a new page, files in HTTP cache | 1.7 to 1.9 s           |                        |
| Warm run                                     | 9 to 54 ms             | 3 to 6 ms              |
| First run after a timeout                    | 0.4 to 0.9 s           | the start, about 1.5 s |

The five files are `pyodide.js` (the loader, 15 KB), `pyodide.asm.js` (1.3 MB),
`pyodide.asm.wasm` (10.1 MB), `python_stdlib.zip` (2.4 MB, already compressed) and
`pyodide-lock.json` (130 KB). CPython in WebAssembly runs plain loops at roughly half the
speed of native CPython, so a performance test's `timeLimitMs` for Python needs more room
than the same test in JavaScript. The gate measures it on the same engine.

### How the frame gets Pyodide

The frame can fetch nothing: `default-src 'none'`, an opaque origin, and a service worker
that never sees its requests: a document with an opaque origin is nobody's client. The CSP
is not loosened for Python.
Instead:

1. On the first Python run, `IframeRunner` calls `loadPythonAssets`, which fetches
   `/pyodide/0.29.5/*` on the app origin. The service worker answers these cache-first from
   `understory-python-v2` after the first time, and they are never precached: most learners
   never run Python. The frame's own requests could never reach that cache. The runner
   document comes from the service worker too (see "Offline"), so Python runs offline
   once the files have been fetched once.
2. The parent posts them to the frame in one `python-assets` message, once per frame. The
   schema allows each file up to 32 MB and nothing but `ArrayBuffer`s.
3. The frame keeps them and starts one Pyodide worker from a blob, as for JavaScript. The
   worker evaluates the loader and the runtime with indirect eval (the frame already has
   `'unsafe-eval'`, which also covers compiling WebAssembly). The loader then asks `fetch`
   for the lock file, the standard library and the wasm binary. Until the start is done,
   `fetch` is a function that answers those three names from memory and refuses anything
   else. Then it is blocked with the other network APIs, before any learner code runs.

### A warm worker, and timeouts

A start costs 1.5 to 3 seconds and a run a few milliseconds, so the Python worker lives
across runs. The frame hands it one run at a time. A run's `timeoutMs` starts only when the
warm interpreter receives the run: the frame then sends `started`, and the parent's watchdog
waits up to `pythonBootTimeoutMs` (60 s) for that before it counts `timeoutMs` plus the
grace. A slow start therefore never turns into a timeout verdict.

Python in a worker cannot be interrupted without `SharedArrayBuffer`, which needs
cross-origin isolation that an opaque-origin frame does not have. So a timeout terminates
the worker and starts a new one at once, which the next run finds half warm. The same
happens to a run that a newer run supersedes, and to a run whose interpreter itself failed
(`fatal` on the worker's `done`).

Between runs the harness restores what a run can change: stdout and stderr, the module
table (modules the code created go, standard-library imports stay), the builtins and the
recursion limit. Code still shares a process with later runs, so it could, for example,
register a message listener and see the next run's tests. That is the same trade as
"Integrity" above: the mark is not protected, the host is.

### The Python harness

The same shape as the JavaScript one: `run(code, tests, host_log)` returns
`{ status, tests, logs, error? }`, and `harnessReportSchema` checks it. `run_async` takes the
same arguments and returns the same report as a coroutine; the browser and the gate call
it, so a test may be `async def` ("Async tests"). iOS calls `run_async` too. Code and tests
share one namespace, and the namespace is also the module `solution`. Printed lines stream
to the parent as they happen. A plain `assert a == b` in the tests is rewritten so that a
failure reads `Expected b, received a`. Line numbers: a syntax or runtime error in the
learner's code carries `line`; one in the tests says `(tests, line N)` in the message.
docs/CONTENT-GUIDE.md shows the author's side.

For assessments (docs/INTERVIEWS.md), `src/core/assessment/evaluate.ts` puts one line,
`__only = N`, in front of the tests. The harness removes it before compiling, so line
numbers stay the author's, and registers only the N-th test. `__only = -1` lists the names.

### The Node gate

`NodePyodideRunner` loads the `pyodide` package, the same version and bytes, in one warm
`worker_threads` worker with the same harness string. Runs queue; each gets its budget
from the moment the thread says `started`, after the run's packages are loaded; a timeout terminates the thread and the next
run starts a new one. `byLanguage` in `src/core/running` routes Python there and
everything else to `NodeWorkerRunner`, and the gate creates the Python side only when a
Python challenge appears.

### Packages

Three packages beyond the standard library, chosen for the AI chapters: `pydantic` (with
`pydantic_core`), `numpy` and `pandas`. Their wheels are the ones the Pyodide 0.29.5
distribution ships, pinned by the SHA-256s in the `pyodide-lock.json` the npm package
carries. Nothing else can be imported; `micropip` is not there and the frame could not
reach an index anyway.

| Package  | Wheels it needs                                                                              | Size   |
| -------- | -------------------------------------------------------------------------------------------- | ------ |
| numpy    | numpy 2.2.5                                                                                  | 2.8 MB |
| pandas   | pandas 2.3.3, numpy, python-dateutil, six, pytz                                              | 8.1 MB |
| pydantic | pydantic 2.12.5, pydantic_core 2.41.5, typing_extensions, annotated_types, typing_inspection | 2.0 MB |

All ten files come to 10.0 MB. The wheels are already compressed, so gzip gains nothing.

**Where they come from.** The npm package holds the interpreter, not the wheels.
`src/adapters/pyodide/wheels.ts` fetches each wheel from jsDelivr's copy of the same
release (`cdn.jsdelivr.net/pyodide/v0.29.5/full/`) into `node_modules/.cache/understory-pyodide/`,
and keeps a file only when its SHA-256 matches the lock file. `scripts/copy-pyodide.ts`
then copies them next to the five start files in `public/pyodide/0.29.5/`. So the first
build on a machine downloads 10.0 MB once; later builds, the gate and the unit tests read
the cache and need no network.

**Which packages a run needs.** `importedPythonPackages` in
`src/core/running/python-packages.ts` reads `import x`, `import x as y` and `from x.sub
import y` at the start of any line of the code and the tests, and `prepareRun` adds any
the request names (`RunRequest.packages`, from the step's `packages` field). A scan, not
a parser: an import inside a string loads a package early, and `__import__("numpy")` is
not seen and fails with Python's own `ModuleNotFoundError`.

**How the frame gets them.** As with the start files, the parent fetches, the frame cannot:

1. On the first run that needs a package, `IframeRunner` calls `fetchPythonPackages`,
   which reads the lock file (already cached), works out every wheel the packages need,
   dependencies first, and fetches those this frame does not hold yet from
   `/pyodide/0.29.5/`. The service worker keeps them cache-first in `understory-python-v2`,
   as it keeps the start files, so each is downloaded once per device and never precached.
2. The parent posts them in one `python-packages` message: file names that match a wheel's
   and nothing else, bytes only, at most 32 files, each under the asset cap. The frame
   keeps them for its life and hands them to the interpreter, and to any interpreter it
   starts after a timeout.
3. The run message names the packages. The worker calls Pyodide's `loadPackage` for those
   it has not loaded, which asks `fetch` for each wheel. After the start, `fetch` is still
   blocked for everything else: it answers exactly the wheel names it holds, from memory,
   and throws `fetch is not available in the sandbox` for any other URL. It can reach
   nothing the worker was not handed. The worker then imports each package once, and only
   then says `started`.

**The budget.** A run's `timeoutMs` starts at `started`, so neither the download nor the
first import counts against it. The first import is slow. Measured in Node on Apple
silicon, on top of the 1.2 s start: pydantic 0.3 s, numpy 0.8 s, pandas with numpy 3.2 s.
A phone takes longer. The start allowance (`pythonBootTimeoutMs`, 60 s) covers the start
and the packages together. Imported packages stay in `sys.modules` between runs (the
harness keeps modules under `/lib/`), so later runs pay nothing.

**The status line.** `IframeRunner` reports `RunProgress` while a run waits: the step shows
"Loading Python and numpy…" on the first run, "Loading numpy…" when Python is already warm,
and "Running" once the frame says `started`. The status sits in a live region, so a screen
reader hears it.

**The gate.** `NodePyodideRunner` calls `ensureWheels` for a run's packages, then its
thread loads them with `packageCacheDir` pointed at the cache, imports them and says
`started`, as the browser worker does. Its budget starts there too.

### Async tests

The hosts call the harness's `run_async`, a coroutine, and await it on Pyodide's event loop,
the webloop, which runs on the worker's own timers (Node's in the gate). A test written as
`async def` is awaited; `asyncio.sleep`, `gather`, `Semaphore`, `wait_for` and `timeout`
all work, because they only need that loop.

What does not work, and why:

- `asyncio.run` inside the code or a test. It must block until its loop is done, and the
  webloop cannot be blocked from inside: Pyodide would raise a message about stack
  switching. The harness replaces it during a run with one that says what to write instead,
  and restores it after. Tests await the learner's coroutine; the learner never starts a
  loop.
- Top-level `await` in the code or the tests. It is a syntax error, as in a `.py` file.
- Threads. `threading.Thread.start` raises `RuntimeError: can't start new thread`:
  WebAssembly in the browser has no threads for Python. `asyncio.to_thread` does not fail,
  but Pyodide's loop runs the function there and then, so it overlaps nothing.
- An `await` that never ends is a timeout, as a loop that never ends is: the frame replaces
  the worker. Tasks a run started and never awaited are cancelled when it ends, so they
  cannot print into the next run.

iOS awaits `run_async` in its worker the same way.

### Limits

- Packages: numpy, pandas and pydantic, nothing else. `input()` has no input. Challenges
  are functions with tests, as on online coding assessments.
- A tight recursion with the limit lifted can take seconds to raise `RecursionError` in a
  worker thread. It ends as a timeout or a failed test, and the next run still works.
- No `asyncio.run`, no threads (see "Async tests").
- Python runs offline only after one Python run online, and a package only after one run
  that imported it. The files are cached on that run, and a lesson downloaded for offline
  use does not fetch them ahead of time.
- A package the app does not ship makes the step web only on iOS (`StepRuntime`): the step
  says so and offers the web instead of failing with `ModuleNotFoundError`.

## Offline

Code runs with the network cut once the service worker controls the page: js and ts at
once (the runner is precached), tsx after one tsx run, Python after one Python run, a
Python package after one run that imported it, and SQL after one sql step (their files are
cached on first use). The TypeScript checker works offline after one
type-checked step was shown online; before that, runs are graded on the tests alone
("Type checking"). The runner document, `/sandbox/runner.v1.html`, is
answered from the worker's static cache with the headers it was stored with, its CSP
included, so the frame has the same opaque origin and the same `default-src 'none'`
offline as online.

### Why the frame has no `sandbox` attribute

Until September 2026 no code ran offline: the run ended in `SandboxError: the sandbox did
not answer`. The runner was precached, yet the frame's navigation never reached the worker.
Measured with Playwright against the production build, the page controlled, in Chromium
(desktop) and WebKit (iPhone 15 profile):

| Frame                                                                | Answered by the worker                                     | Result                                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sandbox="allow-scripts"`, `src` the runner                          | No, in either engine                                       | Offline: an error page (Chromium) or `about:blank` (WebKit). A marked copy put in the cache is not shown: the network copy is.                         |
| No attribute, `src` the runner, header `sandbox allow-scripts`       | Yes, in both engines                                       | The marked cached copy is shown. Origin `'null'`, `localStorage` and `parent.document` throw `SecurityError`, `eval` works. Loads offline in Chromium. |
| `sandbox="allow-scripts"`, `src` a `blob:` URL of the fetched runner | Not needed: the parent fetches the text through the worker | Refused: the app CSP has `frame-src 'self'`, which does not allow `blob:`.                                                                             |

The first row is the rule both engines follow: the worker is chosen before the response
arrives, and a frame whose sandbox flags already force an opaque origin is not handed to
any worker. A `sandbox` directive in the response header is only known once the response is
there, so the request is still the worker's to answer, and the document it builds from the
cached response is then sandboxed by that header.

The candidates, and why the second row won:

- **(a) The worker answers the frame; the header alone sandboxes it.** Chosen. The worker
  already precached the runner with its headers; only the attribute stood in the way. The
  wall is unchanged: the same header, the same flags, the same `default-src 'none'`. The
  attribute's one job, covering a stripped header, moved to the three fail-closed checks
  in "The iframe".
- **(b) The attribute, with the worker serving `src`.** Impossible: the first row. Neither
  engine gives the worker a frame that is sandboxed before it loads.
- **(c) The parent fetches the runner and loads it from a `blob:` URL in a sandboxed
  frame.** Rejected. It would need `blob:` in the app's `frame-src`, and a `blob:` document
  inherits the policy of the page that made it, not the runner's header. The app's policy
  has no `'unsafe-eval'` in production, which the harness needs, and it has
  `connect-src 'self'`. Making it work means loosening the app's own CSP.
- **`srcdoc`.** Rejected for the same reason as in version 1: it inherits the parent's CSP.

### Testing it, and what WebKit does not allow

`tests/e2e/offline.spec.ts` has two tests. On desktop Chromium: one online run each of
js, tsx and Python, then `setOffline(true)`, a reload (a new frame, runtime and
interpreter), the same three runs passing, and the isolation probe (no parent, no storage,
no network, opaque origin) passing in the frame the worker served. On both engines: a copy
of the runner with a different title is put in the worker's cache; the frame shows that
title, so the worker answered it, and the three runs and the isolation probe pass in it.

WebKit cannot run the first test. Playwright's offline emulation there fails every request,
including those the worker would answer from its cache, and a routed abort is applied
before the worker sees the request. The second test is WebKit's proof that the worker
answers the frame; together with the cached runtime and Pyodide files it checks, that is
everything an offline run needs.

`tests/e2e/sandbox.spec.ts` covers the check that fails closed: a runner whose CSP header
is removed on the way is never started. The two tests there that replace the runner on
the network block the service worker, which would otherwise answer from its cache.

### On iOS

`PythonRunner` in `ios/UnderstoryKit` runs Python in a hidden `WKWebView` with the same
Pyodide bytes and the same Python harness (`python-harness.v1.py`, written from
`PYTHON_HARNESS_V1` by `build-resources.ts`), and returns the same report.
`CodeRunnerByLanguage` routes to it as `byLanguage` does on the web.

Why not JavaScriptCore: Pyodide is WebAssembly. A `JSContext` in an app on iOS runs
without a JIT, and without one it has no usable WebAssembly; the app cannot get the JIT
entitlement. On macOS a `JSContext` does have `WebAssembly` (checked), which is why this
is an iOS limit and the macOS test run cannot prove it either way. A `WKWebView` runs its
JavaScript in WebKit's content process, which has the JIT, WebAssembly and Web Workers,
and Pyodide runs in Safari on iOS.

The shape is the browser frame's:

1. **Lazy.** Nothing of WebKit exists until the first Python run. That run makes sure the
   files are on disk (below), builds one web view and starts one warm Pyodide worker. Runs
   queue and reuse it.
2. **Nothing from the network.** The web view's data store is non-persistent. Everything
   it loads comes from `understory-runner://runner/`, served by `RunnerSchemeHandler`:
   the page, its script, the worker script, the Python harness and the five Pyodide files,
   and a 404 for anything else. A content rule list blocks every http, https, ws, wss and
   ftp load. The page's policy is `default-src 'none'; script-src 'self'; connect-src
'self'; worker-src 'self'`; the worker's is `default-src 'none'; script-src
'unsafe-eval' 'wasm-unsafe-eval'`, so it loads nothing at all.
3. **The worker** is `python-worker-source.ts`'s body: the page posts it the five files
   and the harness, it evaluates the loader and the runtime, answers the loader's three
   `fetch` calls from memory, starts Pyodide, runs the harness and then blocks `fetch`,
   `XMLHttpRequest`, `WebSocket`, `importScripts` and the rest before any learner code.
   `PythonRunnerTests` checks that `js.fetch` and `js.XMLHttpRequest` fail from Python.
   Runs call the harness's `run_async`, so `async def` tests are awaited.
4. **Packages.** The run's packages are the web's: what the code and the tests import
   (`PythonPackages`, a port of `importedPythonPackages` with the web's test cases) plus
   what the step names. The page fetches the wheels they need from the scheme handler,
   posts them to the worker once, and hands them to every worker it starts after a
   timeout; the worker's blocked `fetch` answers exactly those names from memory. The
   worker loads and imports them, then says `started`.
5. **Timeouts.** The page starts a run's budget at `started`, once the packages are
   imported, as the frame does, so pandas' slow first import is never the learner's. On
   overrun it terminates the worker, reports `timeout` with the lines printed so far and
   starts a new worker at once. Swift keeps an outer deadline (the start allowance of 60 s,
   which covers the packages too, plus the budget, plus the grace) for a page that stops
   answering, and then drops the
   whole web view. A content process that dies is dropped the same way; the next run
   builds a new one.

**The files.** 13.2 MB raw is too much to add to every install for a language most
learners never run, so the files are not in the app bundle. `PyodideAssetStore` downloads
them once, on the first Python run, into Application Support/Understory/pyodide/0.29.5/
(excluded from backup), from a source the app names: the web app's own
`/pyodide/0.29.5/` (`PyodideAssetStore.webAppSource`), or any folder with the same bytes.
Every file is checked against the size and SHA-256 in `pyodide.v1.json`, which
`build-resources.ts` computes from the installed `pyodide` package (pinned exactly in
package.json). A download reaches its final name only once it matches; a damaged file on
disk is fetched again; a source serving other bytes is refused. The check runs once per
process and takes about 10 ms. jsDelivr's `pyodide/v0.29.5/full/` served identical bytes
when checked. The wheels are handled the same way, but only on the first run that needs
them: `pyodide.v1.json` also pins every wheel numpy, pandas and pydantic need (ten files,
10.0 MB) with the lock file's SHA-256, per package in load order, and
`PyodideAssetStore.ensure(packages:)` fetches those a run asks for.

**Numbers**, `swift test` on Apple silicon, macOS 26, files already on disk:

|                                                  |                   |
| ------------------------------------------------ | ----------------- |
| Copy and check the five files (local source)     | 35 ms             |
| Check only, a later launch                       | 10 ms             |
| First run: web view, worker, Pyodide start, run  | 2.1 s             |
| Warm run (the three-test fixture)                | 6 to 10 ms        |
| `while True: pass` with a 1,000 ms budget        | timeout at 1.02 s |
| First run after a timeout (new worker starting)  | 1.5 s             |
| numpy, pandas and pydantic, first import and run | 3.0 s             |

**Tests.** WebKit is on macOS too, so `PythonRunnerTests` runs under plain `swift test`,
no simulator: the solution passes, the starter fails with the harness's message, a
syntax error carries its line, a spin is a timeout and the next run passes, the network
APIs are gone, numpy, pandas and pydantic import within a one-second budget (the import
is not on the clock), a step can name a package, an `async def` test is awaited and an
`await` that never ends is a timeout. They take Pyodide from the repo's
`node_modules/pyodide` and the wheels from the web build's cache
(`node_modules/.cache/understory-pyodide/`) through the store, so the checksums are
exercised on every run, and they are skipped when `pnpm install` has not run.

On the iOS simulator (`xcodebuild test -scheme UnderstoryKit-Package`) the store tests
pass, but in a SwiftPM test bundle, which has no host app, the web view's page never
loads, and the runner reports `SandboxError` after its load deadline rather than hanging.
So the tests that run Python, a playground or SQL are skipped there (`UNDERSTORY_WEBVIEW_TESTS=1` forces
them). Proving the web view on iOS needs an app-hosted test target, which arrives with the
app.

**Open on iOS.** Not yet run inside an app or on a device. The three hidden web views
(Python, SQL, and a playground judged off screen) set `inactiveSchedulingPolicy = .none`,
so WebKit does not suspend them while a run is in flight; a page's own timers are still
stretched while it is not visible, which only slows a React check's actions (see
"Playgrounds on iOS"). The app should keep the Python and SQL views in the view hierarchy
(hidden, zero size) while a lesson that needs them is on screen.

## Out of scope for version 1

- DOM challenges with learner JavaScript. They would run on the frame's main thread,
  where an infinite loop cannot be terminated from inside the frame and freezes the tab
  in browsers that share a process between the frame and the app. They wait for a loop
  guard inserted at transpile time. Version 1 DOM challenges are HTML and CSS only and do
  not use this runner.
- Languages other than JavaScript, TypeScript, TSX and Python. `RunRequest.language` leaves
  room.
- Per-test timeouts inside one run (assessments isolate tests instead), `expect(...).resolves`
  and `rejects`, mocks, snapshots.
- Protecting the mark from the learner. See "Integrity".
- CPU or memory quotas in the browser beyond the timeout. A worker that allocates
  without end is killed by the browser or by the timeout, whichever comes first.
