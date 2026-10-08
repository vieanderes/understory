# Curriculum

The course holds 423 lessons. Each lesson is marked **E** (beginner-essential) or
**A** (advanced). The count is 250 E and 167 A. A module names its lab where a moving
simulation teaches what a playground cannot; the rest are hands-on through playgrounds, sql
steps and challenges.

This map came out of the planning research on 2026-09-17. It is the source for
`content/course/`. Change it here first, then in the content.

## Parts

The chapters are grouped into seven parts, each with a checkpoint, a capstone and a
milestone at its end (`docs/LEARNING-SCIENCE.md`, C, "Parts and milestones"). The parts,
their summaries and their capstone briefs live in `content/course/course.yaml`. The woven
modules (17 CS fundamentals, 26 Clean code, 27 Code like a pro, 29 Next.js on the server,
32 Engineering judgment, 33 Explaining your work) belong to no part: each of their lessons
counts towards the part of the lesson it is woven after, so the lesson counts below include
them. Module folders are numbered in the order they were added, so 30 Integrations sits
after 14 Scale and 31 Agent engineering after 21 AI systems.

| Part | Title                     | Modules                                                                    | Lessons | Capstone                      |
| ---- | ------------------------- | -------------------------------------------------------------------------- | ------- | ----------------------------- |
| 1    | First code                | 0 First steps, 1 HTML, 2 CSS                                               | 33      | A reading list page           |
| 2    | JavaScript and TypeScript | 3 JavaScript, 4 TypeScript, 5 Tooling                                      | 58      | A typed shopping cart         |
| 3    | Interfaces                | 6 React, 7 Next.js, 8 Design systems                                       | 31      | A small storefront            |
| 4    | Servers and data          | 9 Backend, 10 Databases, 11 Testing                                        | 56      | A booking API                 |
| 5    | Production                | 12 Security, 13 Performance, 14 Scale, 30 Integrations, 15 Arch., 16 Cloud | 94      | The booking API in production |
| 6    | Python and AI engineering | 18 Python, 19 Python for AI, 20 AI eng., 21 AI systems, 31 Agents          | 70      | A support assistant           |
| 7    | Senior engineer           | 22 System design, 23 Patterns, 24 Atlas, 25 Career, 28 Interviews          | 75      | A design review pack          |

## Chapters

There is no story spine and no recurring product. Each chapter says in one sentence why it
matters and what the learner can build afterwards. Examples inside lessons are plain,
realistic and varied (`docs/AUTHOR-BRIEF.md`, "Examples"). `module.yaml` holds the same text
as `why` and `youCanBuild`.

| Module | Why it matters                                                                                                                          | You can build                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | Every program you'll ever write is built from these few ideas.                                                                          | A small to-do list program, written from scratch.                                                                                                                   |
| 1      | Markup decides whether a page works for search engines, screen readers and slow phones.                                                 | A semantic page with a form that works without JavaScript.                                                                                                          |
| 2      | Layout bugs are easy to cause and hard to see until a real screen shows them.                                                           | A responsive layout on an 8 pt grid, with design tokens as custom properties.                                                                                       |
| 3      | Most browser bugs start with JavaScript doing exactly what it was told.                                                                 | A shopping cart with quantity rules, written unplugged.                                                                                                             |
| 4      | Types catch whole families of bugs before the code ever runs.                                                                           | A typed data model with runtime validation where data enters.                                                                                                       |
| 5      | A build you cannot reproduce fails on the day it matters most.                                                                          | A reproducible build, a lint and type-check gate, and an env schema.                                                                                                |
| 6      | Keeping a page in step with its data by hand is where interface bugs come from. React does that part for you.                           | A small React app with a form, a filtered list and data loaded from a server, each piece of state in the right place.                                               |
| 7      | React draws a page, but a real site also needs URLs, fast first loads and a safe place for data and secrets.                            | A Next.js site with several pages, a shared layout, a search box that runs in the browser and data loaded on the server.                                            |
| 8      | An interface that some people cannot operate is a broken interface.                                                                     | An accessible form, a themed component library with variants, and a dialog that handles focus.                                                                      |
| 9      | The server is where trust, money and data meet.                                                                                         | An API with sessions, ownership checks and an idempotent payment webhook handler.                                                                                   |
| 10     | Data outlives the code that writes it, so mistakes here last longest.                                                                   | A schema with keys and constraints, safe queries from code, an index that fixes a slow page, a transaction that can't half-happen, and row-level security.          |
| 11     | Tests let you change code without fear.                                                                                                 | A test suite with unit tests, integration tests on a real database, one end-to-end journey and a load test.                                                         |
| 12     | An attacker needs only one open door.                                                                                                   | A threat model, a page that shows hostile input as text, safe cookie and CORS settings, access-control tests, safe uploads, and an audit of a small app.            |
| 13     | Slow pages lose people before they read a word.                                                                                         | A page and an API measured before and after: no blocking scripts, no jumping content, no leaks, honest caches and one query instead of 201.                         |
| 14     | Code that is correct for one user can be wrong for two at once.                                                                         | A batched, rate-safe pipeline of model calls, an idempotent payment endpoint, a queue worker for long AI jobs, and a scheduled job that runs once across servers.   |
| 15     | When every change touches twelve files, the structure is the problem.                                                                   | A modular monolith refactored under tests, with thin handlers, ports for storage and the model, an outbox, and decision records.                                    |
| 16     | Code only helps people once it runs somewhere reliable.                                                                                 | A containerised deploy behind a reverse proxy, a zero-downtime release, dashboards and a tested restore.                                                            |
| 17     | These ideas explain why code is fast, slow or wrong.                                                                                    | Five complexity analyses of real code, written up as notes.                                                                                                         |
| 18     | Python is the language of the AI and data world, and most model tooling is written for it first.                                        | A typed command-line tool that reads a JSON file of eval results and prints a report, with exit codes CI can trust.                                                 |
| 19     | Model services, eval pipelines and data work are written in Python, and they fail in Python-specific ways.                              | A FastAPI service that calls a model, validates its reply with Pydantic, streams it, retries on rate limits, and is tested with a fake client.                      |
| 20     | A language model is a component that can be wrong in new ways.                                                                          | A support assistant with retrieval, tool use and an evaluation suite.                                                                                               |
| 21     | A demo needs a prompt, but a product needs routing, guardrails, evals and budgets around it.                                            | A support pipeline where code owns the flow: a classifier routes each ticket, a guarded agent acts, humans approve risky steps, and evals gate every prompt change. |
| 22     | Architecture decisions are expensive to reverse, and a design review or interview tests how you reason about them.                      | Written designs for a link shortener, a feed, a document assistant and an agent, each with requirements, numbers, a sketch, deep dives and failure modes.           |
| 23     | A coding round tests whether you can turn a problem into a known pattern and explain the cost.                                          | A solved set of classic problems, one per pattern, each with tests and a complexity note.                                                                           |
| 24     | The right platform saves months, and the wrong one costs them.                                                                          | A written platform decision, an offline-first website, and a safe server endpoint for an app's AI feature.                                                          |
| 25     | Being good at the work and showing it in an hour are separate skills, and the second one can be practised.                              | A one-minute introduction, a bank of five STAR stories, questions for each interviewer, a counter-offer email and a 90-day plan.                                    |
| 26     | Code is read far more often than it is written, and every unclear line costs the next person time.                                      | A messy module refactored under tests, with a written review explaining each change.                                                                                |
| 27     | Reviewers judge your skill in seconds from small signs, and the same signs decide how easy your code is to live with.                   | A before-and-after portfolio: one amateur snippet per language rewritten to a professional standard, with the reasons.                                              |
| 28     | Each format rewards a different way of working, and knowing the format is worth as much as another practised pattern.                   | Three timed mock assessments passed, a set of practical and AI build tasks with tests, and a rehearsed plan and presentation for a four-hour build.                 |
| 29     | Once you know requests, sessions, databases and servers, Next.js runs your API, forms and caching beside your React code.               | A Next.js app with a JSON endpoint, a form that saves safely, cached pages that refresh, and a deployment you run yourself.                                         |
| 30     | Most products depend on data that lives in someone else's system, and that system will change, fail and lie to you.                     | A nightly sync from a vendor API with a tie-broken cursor, token refresh, change detection by hash, deletions behind a safety valve, and reconciliation.            |
| 31     | An agent that runs for hours with real tools fails in ways a single model call never does, and the harness decides how far that goes.   | A budgeted, resumable agent with permission hooks, well-designed tools, scoped memory, a review queue, a pass^k eval suite and traces that find the costly run.     |
| 32     | Writing code is getting cheaper, and knowing what will break, leak or confuse before it ships is what makes an engineer worth trusting. | A review of an AI-written pull request covering security, efficiency, regressions and tests, with a pre-mortem, a ranked plan and a workflow diagram.               |
| 33     | Work nobody understands does not get used, reviewed or trusted, and explaining it well is a skill you can practise.                     | A one-page design doc, an incident update and a recorded walkthrough of a diagram, each explained to two different audiences.                                       |

## Module 0: First steps in JavaScript (11)

Programming from zero. Nothing is assumed: no terminal, no files, no install. Every lesson
runs in the app's editor and uses only what earlier lessons taught. An experienced developer
tests out in a few minutes or skims it as a refresher.

1. Your first line of code `basics.first-program`: run code, print a value with `console.log`, numbers and text. **E**
2. Variables `basics.variables`: give a value a name with `let` and `const`, and change it. **E**
3. Maths and text `basics.operators`: arithmetic, joining text, and template literals. **E**
4. Making decisions `basics.conditions`: comparisons, `true` and `false`, `if` and `else`. **E**
5. Repeating things `basics.loops`: `for` and `while` loops, and counting. **E**
6. Functions `basics.functions`: parameters and return values, and why to name a piece of work. **E**
7. Lists `basics.arrays`: arrays, indexes, `length`, adding items and looping over them. **E**
8. Objects `basics.objects`: properties, nested data, and a list of objects. **E**
9. Errors and stack traces `basics.debugging`: read an error message, picture the call stack, and follow a stack trace to the bug. **E**
10. Watching code run `basics.watching-code`: watch values with a `console.log` probe, and pause code with breakpoints and stepping. **E**
11. A small program `basics.small-program`: build a to-do list from everything in this chapter. **E**

The former Orientation topics moved to where they are needed: the terminal, Git and working
with AI open Tooling, what a backend is opens Backend, and what a computer does is a CS
fundamentals lesson. How the app teaches is a short welcome, not a lesson.

## Module 1: HTML (7)

**Hands-on:** live playgrounds with a DOM tree view, which show the tree a piece of markup
produces as the learner types. No separate lab is planned.

1. Your first web page `html.first-page`: write headings and paragraphs, and nest elements into a whole page. **E**
2. Lists, links and images `html.everyday-elements`: build lists, link pages together and add images with useful `alt` text. **E**
3. The DOM `html.the-dom`: read the tree a browser builds from HTML, and change the page with one line of JavaScript. **E**
4. Semantic structure `html.semantic-structure`: choose buttons, landmarks and heading levels so every visitor can find their way. **E**
5. Links and URLs `html.links-and-urls`: write link and image paths that lead where you mean, and link to a place on the page. **E**
6. Forms `html.forms`: build a labelled form that sends the right data and checks it without JavaScript. **E**
7. Images and the head `html.media-and-head`: stop images from shifting the page, offer them in several sizes, and fill in the head. **E**

## Module 2: CSS (13)

**Lab: Box Model Explorer + Flex/Grid Playground**, which shows the computed geometry while the
learner changes box, flex and grid settings. Every lesson is built around live playgrounds: the
learner writes CSS and watches the page change.

1. What CSS is `css.what-css-is`: write CSS rules that colour and shape a page, and pick out elements with a class. **E**
2. Selectors and the cascade `css.cascade`: target elements with selectors, and predict which rule wins when two clash. **E**
3. The box model `css.box-model`: space a box with padding, border and margin, and stop it spilling off a phone. **E**
4. Block, inline and display `css.display-and-flow`: predict how boxes flow down a page, switch it with `display`, and tame content that overflows. **E**
5. Flexbox `css.flexbox`: build a nav bar, centre anything, and stop a long title pushing the rest off screen. **E**
6. Grid `css.grid`: build a card grid and a page layout with tracks, areas and auto-placement. **E**
7. Positioning and z-index `css.positioning`: pin a badge to a card, stick a header to the top, and explain why a `z-index` does nothing. **E**
8. Units and responsive design `css.responsive-design`: size with relative units, and adapt a layout with media queries, container queries and `clamp()`. **E**
9. Custom properties `css.custom-properties`: name values once with custom properties, and switch a whole page to a dark theme. **E**
10. Text and fonts `css.typography`: choose a font stack, set comfortable lines of text, and load a web font without surprises. **E**
11. Transitions and transforms `css.transitions`: move, turn and scale elements, and animate a change smoothly. **E**
12. Build a page `css.build-a-page`: build a responsive event page from a plain one, with a header, a card grid and a theme. **E**
13. Modern CSS architecture `css.modern-architecture`: organise a style sheet with `@layer`, nesting, `:has()` and logical properties. **A**

Grow and shrink arithmetic, percentage padding, `fixed` inside a transform, font metric
overrides and custom-property edge cases live in the deep dives.

## Module 3: JavaScript (19)

**Lab: Event Loop Stepper**, which steps through the call stack, task queue, microtask queue
and render steps. Every lesson that touches the page is built around live playgrounds.

1. JavaScript meets the page `js.meets-the-page`: run a script in a page, change what it shows and react to a click. **E**
2. Values, types and coercion `js.coercion`: predict what `+`, `==` and a condition do with mixed types, and turn form input into numbers. **E**
3. The built-in toolbox `js.built-in-toolbox`: string, number, `Math`, `Object`, `Set`, `Map` and JSON helpers. **E**
4. Everyday syntax `js.everyday-syntax`: `&&`, `||` and `!`, optional chaining and `??`, `switch`, `break` and `continue`. **E**
5. Destructuring, spread and defaults `js.destructuring-and-spread`: unpack objects and arrays, copy and merge them with spread, and give parameters defaults. **E**
6. Arrays and iteration `js.arrays`: arrow functions for `map`, `filter`, `find` and `reduce`, and which methods change the array. **E**
7. Variables, scope and closures `js.closures`: trace which variable a function reads, and keep state private in a closure. **E**
8. References, copying and immutability `js.references-and-copying`: predict which changes two variables share, and update data without changing the original. **E**
9. Errors `js.errors`: throw, catch and clean up after errors, and never hide one. **E**
10. Changing the page `js.changing-the-page`: read what someone typed, switch classes, and add and remove elements. **E**
11. Events `js.dom-events`: typing and form submits, `preventDefault`, bubbling and delegation. **E**
12. Classes and prototypes `js.prototypes-and-classes`: write a class with a constructor, methods and private fields, and see the prototype link underneath. **E**
13. Functions and `this` `js.functions-and-this`: work out `this` from the call, and keep it when a method becomes a click handler. **E**
14. Modules `js.modules`: split code into files with `export` and `import`, and load them in the browser. **E**
15. Promises and async/await `js.promises`: wait for slow work, catch its errors, and run several jobs at once. **E**
16. The event loop `js.event-loop`: why a long task freezes the page, and the order of timers, promise callbacks and painting. **E**
17. Browsers, servers and requests `js.requests-and-responses`: what a request and a response carry, status codes and JSON bodies. **E**
18. Fetching data `js.fetch-cancellation`: load data with `fetch`, show it, send JSON, and cancel requests you no longer need. **E**
19. Build a live search `js.live-search`: a search page that fetches as you type, shows results and errors, and ignores stale answers. **E**

Retry safety and idempotency are taught in Backend and APIs and in Concurrency and scale.
Generators, iterators, `WeakMap` and memory leaks are left to deep dives and to Performance.

## Module 4: TypeScript (9)

**Hands-on:** type-checked challenges. The real TypeScript checker underlines each error and
shows its message, so the learner reads narrowing from the compiler itself.

1. What TypeScript is `ts.what-typescript-is`: write type annotations, read a type error, and know that types are gone when the code runs. **E**
2. Typing everyday code `ts.everyday-types`: type variables, arrays, functions and objects, and handle a property that may be missing. **E**
3. Structural typing `ts.structural-typing`: say whether an object fits a type by its shape, and catch a misspelt property. **E**
4. Unions and narrowing `ts.narrowing`: handle a value that can be one of several things, including `null`, and make the build fail when a case is forgotten. **E**
5. Typing the boundary `ts.typing-the-boundary`: check data from outside your code with `unknown` and a parser, instead of trusting `as`. **E**
6. Generics `ts.generics`: write one helper that works for any type and hands back the type it was given. **E**
7. Deriving types `ts.advanced-types`: build types from one source with `typeof`, `as const`, `satisfies` and helpers like `Partial` and `Omit`. **E**
8. Strictness and escape hatches `ts.strictness`: turn on the checks that catch crashes, and fix an error instead of hiding it with `any`, `as` or `!`. **E**
9. TypeScript in a project `ts.configuration`: set up `tsconfig.json`, match module settings to what runs the code, and treat declaration files with care. **A** Best taken after Tooling's quality gates lesson, since it builds on npm, a bundler and CI.

Authoring mapped and conditional types, method bivariance, array variance and project
references live in the deep dives.

## Module 5: Tooling (11)

**Hands-on:** real commands and their output, and fill-ins on real code. The planned bundle
explorer lab was dropped: build output and a dynamic `import()` carry the idea.

1. The terminal `tooling.terminal`: what a terminal and a shell are, commands, files, folders and paths, with `pwd`, `ls`, `cd`, `mkdir` and `cat`. **E**
2. Pipes, redirection and exit codes `tooling.pipes-and-exit-codes`: chain commands with `|`, save output with `>` and `>>`, and stop on failure with `&&`. **E**
3. What Node is `tooling.node`: run JavaScript outside the browser, read a Node error and its stack trace, and pass settings in with `process.env`. **E**
4. npm and packages `tooling.node-and-npm`: install and use a package, run scripts, and keep installs repeatable with ranges, a lockfile and `npm ci`. **E**
5. Git from zero `tooling.git-basics`: save snapshots with `git add` and `git commit`, read the history, and keep junk and secrets out with `.gitignore`. **E**
6. Branches and merging `tooling.git-as-a-graph`: branches as labels on commits, merge and conflicts, and getting lost work back with the reflog. **E**
7. Remotes and pull requests `tooling.remotes`: clone, push and pull, and open a pull request for review. **E**
8. Working with AI without losing skill `tooling.working-with-ai`: apply generation-then-comprehension and know what to delegate. **E**
9. What a build does `tooling.what-a-build-does`: a dev server versus a production build, transpile, bundle, minify, and source maps. **E**
10. Quality gates `tooling.quality-gates`: linting, formatting, type-checking, and pre-commit and CI parity. **E**
11. Configuration and environment `tooling.configuration-and-environment`: an env schema, keeping secrets out of the bundle, and build-time versus runtime config. **E**

## Module 6: React (15)

**Hands-on:** no lab. The lessons use `tsx` challenges that render components with Testing
Library, and plain-JavaScript
playgrounds for the problems React solves.

1. What React is `react.what-react-is`: describing the page for the current data, components, JSX, and `createRoot`. **E**
2. Props and children `react.props-and-composition`: props, `children`, and conditional rendering with the `0` trap. **E**
3. State and events `react.state-and-events`: event handlers, `useState`, what a hook is, and the rules of hooks. **E**
4. UI as a function of state `react.ui-as-a-function-of-state`: trigger, render and commit, elements as objects, and pure components. **E**
5. State as a snapshot `react.state-as-a-snapshot`: why a setter doesn't change the value you hold, batching and updater functions. **E**
6. Lists and keys `react.lists-and-keys`: `map` and `filter` into elements, stable keys, and what state survives a reorder. **E**
7. Updating objects and arrays `react.updating-objects-and-arrays`: new copies instead of `push` and `sort`, so React renders. **E**
8. Sharing state `react.sharing-state`: lifting state to a common parent, and context. **E**
9. Forms `react.forms-and-actions`: controlled and uncontrolled inputs, `<form action={fn}>`, `useFormStatus` and `useActionState`. **E**
10. Effects `react.effects`: effects, dependencies and cleanup, the loop and the stale interval, and values that need no effect. **E**
11. Fetching data `react.fetching-data`: loading, error and data states, and ignoring answers that arrive too late. **E**
12. Reducers and URL state `react.state-placement`: `useReducer`, state in the address, and choosing where state lives. **E**
13. Build a small app `react.build-a-small-app`: from a sketch to components, the least state, a form, a filtered list and loaded data. **E**
14. Refs and custom hooks `react.hooks-and-refs`: refs for values and DOM elements, and hooks of your own. **A**
15. Performance `react.performance`: measure first, then `useMemo`, `memo`, transitions, Suspense and the React Compiler. **A**

## Module 7: Next.js (6)

React with pages, URLs and a server. The lessons that need the backend, databases or the
cloud live in module 29 and are woven in after those chapters.

1. What Next.js adds `next.what-nextjs-adds`: what a framework adds to React, creating an app with `create-next-app`, running it with `npm run dev`, and why its pages show before JavaScript loads. **E**
2. Pages, layouts and links `next.app-router`: pages from folders, `[slug]` and `await params`, layouts, `<Link>`, and `loading.tsx` and `error.tsx`. **E**
3. Server and Client Components `next.server-and-client-components`: what runs where, `'use client'` on the smallest piece, what props can cross, and hydration. **E**
4. Loading data on the server `next.loading-data`: async Server Components, keeping API keys out of the browser, and streaming a slow part with `<Suspense>`. **E**
5. Static and dynamic pages `next.rendering-spectrum`: reading the build output, the page that froze in production, `revalidate` and `connection()`, and client rendering. **E**
6. Content sites and static export `next.content-and-static-sites`: metadata and share previews, `next/image` and `next/font`, MDX, and static export. **E**

## Module 8: Accessibility and design systems (9)

**Hands-on:** playgrounds and challenges. The planned focus-order and screen-reader simulator
was dropped.

1. Who accessibility is for `design.accessibility-foundations`: the people and assistive technology that use a page, and a role, a name and a state for every control. **E**
2. Keyboard and focus `design.keyboard-and-focus`: every control reachable with Tab, a focus order that matches the layout, and a visible focus ring. **E**
3. Contrast, colour and motion `design.contrast-colour-and-motion`: WCAG level AA in plain words, contrast ratios, never colour alone, and reduced motion. **E**
4. Design systems and tokens `design.design-tokens`: what a design system is, palette and role tokens, and dark mode by theming. **E**
5. Components with good APIs `design.component-apis`: a Button on the native element, variants, and types that refuse a wrong value. **E**
6. Utility-first CSS with Tailwind `design.utility-first-css`: utility classes, the theme as design tokens, and when to extract a component. **E**
7. Accessible widgets `design.accessible-widgets`: `details` and `dialog` before hand-built widgets, focus management, and the ARIA tabs pattern. **E**
8. Forms that help `design.forms-that-help`: labels that stay, hints and errors linked to their fields, and grouped choices. **E**
9. Internationalisation `design.i18n-and-forms`: dates, money and plurals with `Intl`, and the `lang` and `dir` attributes. **A**

## Module 9: Backend, APIs, auth, payments (18)

**Lab: Request Journey**, which steps a URL through DNS, TCP, TLS and HTTP, one hop at a time.

1. What a backend is `backend.what-a-backend-is`: frontend, server, backend, endpoints and APIs, and reading a real response with `curl` and `curl -i`. **E**
2. How a page reaches you `backend.how-a-page-reaches-you`: the parts of a URL, the DNS, TCP, TLS and HTTP hops with `curl -v`, and which hop an error names, with the **Request Journey** lab. **E**
3. Your first endpoint `backend.first-endpoint`: a handler with `Request` and `Response`, routing by method and path, JSON in and out, run with Node. **E**
4. Methods and status codes `backend.http-in-depth`: `curl -X`, `-H` and `-d`, what each method promises, safe and idempotent methods, and 201, 204, 400, 404 and 405. **E**
5. API design `backend.api-design`: resources as nouns, filtering with a query string, and cursor pagination. **E**
6. Errors clients can use `backend.error-responses`: true statuses, one problem details shape, and a logged 500 that leaks nothing. **E**
7. Validation at the trust boundary `backend.validation`: parse every body with a schema, keep only named fields, and stop mass assignment. **E**
8. Sessions, cookies and tokens `backend.sessions-and-tokens`: a session cookie with `HttpOnly`, `Secure` and `SameSite`, a 401 for strangers, and sessions against JWTs. **E**
9. Authorisation `backend.authorisation`: ownership checks, roles, and IDOR. **E**
10. Signing in with another account `backend.oauth-and-passkeys`: the OAuth redirect flow, the `state` check, PKCE, the ID token, and passkeys. **A**
11. Calling other APIs from your server `backend.calling-other-apis`: API keys kept on the server, a proxy in front of a model API, timeouts, and 502 and 504. **E**
12. Rate limits `backend.rate-limits`: a counter per caller, 429 with `Retry-After`, and retrying politely. **E**
13. Webhooks `backend.webhooks`: events from another service, signatures on the raw body, repeats, reordering and idempotent handlers. **E**
14. Payments with Stripe `backend.payments`: Checkout, pence, SCA, an order marked paid only from a verified webhook, and refunds. **E**
15. Files and object storage `backend.files`: uploads with size and type checks, buckets and keys, and signed URLs. **A**
16. Realtime and streaming `backend.realtime`: polling, server-sent events, streaming a model's answer, WebSockets, and the cost of open connections. **A**
17. Changing an API safely `backend.api-evolution`: compatible and breaking changes, expand and contract, versions, and REST, RPC and GraphQL. **A**
18. Long and bulk operations `backend.long-running-and-bulk`: 202 with a status URL and polling, bulk endpoints with per-item results and 207, and JSON Merge Patch against JSON Patch. **A**

## Module 10: Databases (16)

Every lesson runs real Postgres in the browser: the learner writes SQL from the first minute
and reads Postgres's own results and errors.

**Lab: B-Tree Index Explorer**, which shows inserts, page splits, range scans, and seq-scan
versus index-scan cost. **Second lab: Isolation Anomaly Stepper**, which runs two transactions
with interleaving you control.

1. What a database is `db.what-a-database-is`: why not a JSON file, tables, rows and columns, Postgres and SQL, and a first `SELECT`. **E**
2. Finding the rows you want `db.reading-rows`: `WHERE`, `AND` and `OR`, `ORDER BY`, `LIMIT`, and `IS NULL` against `= NULL`. **E**
3. Adding, changing and deleting rows `db.changing-rows`: `INSERT`, `UPDATE` and `DELETE`, the forgotten `WHERE`, and previewing with `SELECT`. **E**
4. Keys and relations `db.relational-model`: primary keys, foreign keys refusing orphans both ways, and one fact in one place. **E**
5. Joining tables `db.sql-queries`: `JOIN`, `LEFT JOIN`, the join that repeats rows, and a `WHERE` that undoes a left join. **E**
6. Counting and grouping `db.grouping`: `count(*)` against `count(column)`, `GROUP BY`, `HAVING`, and the order a query runs in. **E**
7. Designing tables `db.schema-design`: column types, `NOT NULL`, `UNIQUE` and `CHECK`, money in pence or `numeric`, and `timestamptz`. **E**
8. Querying from code `db.from-code`: a driver, `$1` parameters, SQL injection shown safely, ORMs and query builders, and N+1 queries. **E**
9. Indexes `db.indexes`: what an index is, `Seq Scan` against `Index Scan`, column order, `lower(email)`, and the unindexed foreign key. **E**
10. Reading `EXPLAIN` `db.reading-explain`: reading a real plan, the `Rows Removed by Filter` clue, and `EXPLAIN ANALYZE` that deletes. **A**
11. Transactions `db.transactions`: `BEGIN`, `COMMIT` and `ROLLBACK`, a transaction left open, one connection per transaction, and ACID. **E**
12. Constraints as the last line of defence `db.constraints`: the check-then-insert gap, `UNIQUE` and `ON CONFLICT`, and never selling what you don't have. **E**
13. Two writers at once `db.isolation-levels`: the lost update, `stock = stock - 1`, `FOR UPDATE`, deadlocks, and serializable with retries. **A**
14. Migrations `db.migrations`: migration files, adding a required column, expand and contract, lock queues and `CREATE INDEX CONCURRENTLY`. **E**
15. Row-level security and the Supabase model `db.row-level-security`: policies, `USING` and `WITH CHECK`, Supabase roles, and the secret-key hazard. **E**
16. Scaling a database `db.storage-and-pooling`: pooling, read replicas and their lag, caching with Redis, and sharding as the last resort. **A**

## Module 11: Testing (12)

**Hands-on:** a playground runs the learner's tests against three mutants and reports which
survive. The code challenges grade the learner's own tests the same way: they must
pass on the real code and fail on broken copies of it.

1. Your first test `testing.first-test`: what a test is, `test`, `expect` and matchers, reading the runner, and seeing a test fail. **E**
2. What to test `testing.what-to-test`: behaviour over implementation, test levels and the pyramid, risk, and what coverage can't prove. **E**
3. Unit tests `testing.unit-tests`: arrange, act, assert; boundaries; and killing mutants. **E**
4. The TDD loop `testing.tdd`: red, green, refactor on a pricing rule, writing the next failing test yourself. **E**
5. Test doubles and integration `testing.doubles-and-integration`: stubs, fakes and spies at the boundary, the clock, and tests against a real database. **E**
6. Testing a component `testing.components`: Testing Library queries by role and name, user events, waiting with `findBy`, and snapshot rot. **E**
7. End-to-end with Playwright `testing.e2e-playwright`: one purchase path, locators that wait, and fixing a flaky test. **E**
8. Property-based and concurrency tests `testing.property-based`: properties, evals as property checks on model output, invariants, and calls that overlap. **A**
9. Load testing with k6 `testing.load-testing`: latency and throughput, the knee, percentiles, and thresholds. **A**
10. Contract tests `testing.contract-tests`: check that a consumer and a provider agree on an API with consumer-driven contracts, and place them in the test pyramid. **A**
11. Testing code that calls other services `testing.testing-other-services`: HTTP mocking with MSW, sanitised recorded fixtures with schema checks, and real dependencies with Testcontainers. **A**
12. Breaking it on purpose `testing.breaking-it-on-purpose`: stress, soak and spike tests against load tests, fault injection with slow vendors, 500s and timeouts, chaos experiments, and loading an LLM endpoint against provider rate limits. **A**

## Module 12: Security (19)

Every attack runs against the learner's own sandboxed code: an XSS fires in a playground, an
injection reads another table in live Postgres, and each one is then fixed. Lessons 1 to 11
build web-application defence, 12 to 15 the defensive side (abuse, logging, incidents,
layers), 16 attacking your own app within the law, 17 the supply chain, 18 personal data, and
19 is a capstone audit.

1. What attackers want `security.threat-modelling`: what security means for a web developer, the OWASP Top 10 as a map of the chapter, and a threat model with assets, entry points, trust boundaries and STRIDE. **E**
2. Cross-site scripting and CSP `security.xss-and-csp`: an `innerHTML` XSS run live and fixed with `textContent`, escaping per context, a nonce-based CSP and security headers. **E**
3. CSRF and SameSite cookies `security.csrf-and-cors`: origin versus site, why cookies ride along on another site's request, `SameSite` and CSRF tokens. **E**
4. Same-origin policy and CORS `security.same-origin-and-cors`: what the browser lets a script read, an exact-match CORS allow-list, and why `*` never goes with credentials. **E**
5. Injection and SSRF `security.injection-and-ssrf`: a `UNION` that reads another table, parameters and allow-lists for names, and a server that fetches only the hosts it should. **E**
6. Broken authentication and access control `security.broken-auth`: a fresh session at login, single-use reset links, and owner, stranger and signed-out tests. **E**
7. Hashing and passwords `security.cryptography`: hashing versus encryption, salts, and slow password hashes. **E**
8. Encryption, signatures and TLS `security.encryption-and-tls`: symmetric and public-key encryption, MAC versus signature, and what HTTPS does and doesn't protect. **A**
9. Secrets and key management `security.secrets`: secrets out of the repository and the browser bundle, scoped keys, and rotation after a leak. **E**
10. JWT pitfalls `security.jwt-pitfalls`: a payload anyone can read, verifying with pinned settings, keeping tokens out of `localStorage`, and logout. **A**
11. File uploads and path traversal `security.uploads-and-paths`: size and real type checks, server-chosen names, and stopping `../`. **E**
12. Abuse, bots and privacy `security.abuse-and-privacy`: rate limits, bot defence, and GDPR data minimisation. **A**
13. Detection and logging `security.detection-and-logging`: security logging with redaction, detection versus prevention, and alerting on the signals that matter. **E**
14. Incident response `security.incident-response`: a leaked key handled through the lifecycle, containment first, and a blameless review. **A**
15. Defence in depth and zero trust `security.defence-in-depth`: layered checks, verifying every request instead of trusting the network, and switching off what you don't use. **E**
16. Attacking your own app, legally `security.attacker-playbook`: the law and written permission, what your app reveals to a stranger, privilege escalation through mass assignment, and responsible disclosure. **E**
17. When a dependency turns malicious `security.supply-chain`: install scripts, a suspicious lockfile change, and the response to a hijacked package. **A**
18. Personal data by design `security.personal-data`: personal, pseudonymised and anonymised data, lawful bases and Art. 9 special categories, controller and processor with DPAs and sub-processors, retention, erasure and data subject requests, residency and transfers, and audit trails. **A**
19. Capstone: audit an app `security.owasp-top-ten`: find and fix the chapter's flaws in one small app, fail closed, and review AI-written code. **E**

## Module 13: Performance (10)

Every number the lessons state was measured: in Chromium through Playwright, in Postgres
through PGlite, or in Node. The learner fixes real pages in playgrounds, runs real query
plans, and writes the clean-up and caching code.

1. Measure first `perf.measure-first`: latency, throughput and percentiles, timing code honestly with `performance.now()`, and latency budgets with streaming and time to first token. **E**
2. How fast a page feels `perf.web-vitals`: LCP, INP and CLS, Lighthouse on a production build, lab against field data, and reserving space so content doesn't jump. **E**
3. What keeps the screen blank `perf.critical-rendering-path`: parse, layout and paint, render-blocking CSS and scripts, `defer` and `async`, the lazy main image, and font preloads. **E**
4. The cost of JavaScript `perf.cost-of-javascript`: bundles on the main thread, long tasks, INP's three parts, yielding during heavy work, and hydration. **E**
5. Shipping less JavaScript `perf.shipping-less-javascript`: reading a bundle report, code splitting with `import()`, the dev-build trap, and a size budget in CI. **E**
6. Smooth animation `perf.graphics-performance`: frames and jank, `requestAnimationFrame` with the time between frames, animating `transform`, and layout thrashing. **A**
7. Memory leaks `perf.memory-leaks`: the heap and the garbage collector, comparing heap snapshots, detached elements, listeners, timers and closures that hold data. **E**
8. Caching in the browser and CDN `perf.caching-layers`: `Cache-Control`, `ETag` and `304`, hashed file names, and keeping private pages out of shared caches. **E**
9. Caching on the server `perf.server-caching`: cache keys and TTLs, deleting on write, and caching model calls without mixing users. **E**
10. Finding a slow request `perf.backend-performance`: `Server-Timing`, the N+1 behind `Promise.all`, one join with its real `EXPLAIN`, and tail latency across many calls. **A**

## Module 14: Concurrency and scale (11)

**Lab: Overselling Simulator**, which runs N buyers and M servers under a seeded scheduler so
the learner can toggle the strategy and watch the invariant.

1. Many things at once `scale.concurrency-vs-parallelism`: waiting work against computing work, concurrency against parallelism, and the copies of a server that share one database. **E**
2. How many at once `scale.backpressure`: cap the calls in flight, batch model calls, and stop a buffer from growing without limit. **E**
3. CPU work off the main thread `scale.web-workers`: why one request's computing blocks every other, and worker threads and Web Workers with messages. **A**
4. Race conditions `scale.race-conditions`: the gap between a check and its write, single-flight promises, and why a fix in memory fails across copies. **E**
5. Optimistic locking `scale.locks`: a version column that refuses a stale save, 409 Conflict, and retrying automated writes. **A**
6. Holds that expire `scale.overselling`: hold stock while a buyer pays, expire it with guarded transitions, and check that no transition oversells. **A**
7. Idempotency `scale.idempotency`: idempotency keys, so a retried payment never charges twice, and deduplication windows. **A**
8. Queues and workers `scale.queues-and-workers`: long AI jobs on a queue, acknowledging after the work, visibility timeouts, dead-letter queues, and the exactly-once myth. **A**
9. Fair and prioritised queues `scale.fair-queues`: the noisy neighbour, per-tenant round robin, priorities without starvation, and bulkheads. **A**
10. Scheduled jobs `scale.cron`: one run across servers, leases, watermarks for missed runs, and schedules in UTC. **A**
11. Failure handling `scale.failure-handling`: deadlines, retries with backoff and jitter, circuit breakers and load shedding. **A**

## Module 30: Integrations and data sync (9)

Working with systems you don't control. It sits in Production after Scale; its folder number
is 30 because it was added later. Every lesson ends in a TypeScript challenge written as a
pure function. `backend.webhooks`, `scale.idempotency` and `security.abuse-and-privacy`
point here instead of repeating it.

1. Systems you don't control `integrations.systems-you-dont-control`: vendors that break the spec with a 200 and an error body or an HTML error page, runtime schema validation, a tolerant reader for unknown enums, and timeouts. **A**
2. Reading everything, page by page `integrations.paging-through`: a keyset cursor with a tie-breaker, pagination as an async generator, `updated_after`, and the Link header. **A**
3. Tokens that expire `integrations.tokens-that-expire`: refreshing before expiry, one refresh for many callers, rotation, `invalid_grant` and reauthorisation, client credentials, and scopes that quietly return less. **A**
4. Copying data you don't own `integrations.full-and-delta-sync`: pass-through against stored, full against delta, the watermark taken at sync start, an overlap window, and change detection by a hash with stable key order. **A**
5. Noticing what disappeared `integrations.deletions`: mark and sweep, soft deletes, a safety valve for mass deletion, and remote against internal ids. **A**
6. Making messy data consistent `integrations.normalising-data`: pure dates against timestamps, enum mapping with a fallback, empty values, and CSV encodings, delimiters and the BOM. **A**
7. Many vendors, one model `integrations.adapters-and-models`: an adapter per vendor, a capability matrix, a common data model, the raw payload, custom-field mapping and passthrough. **A**
8. Webhooks for speed, polling for truth `integrations.webhooks-and-polling`: thin events that trigger a sync, reconciliation, sending webhooks with a retry schedule, disabling after repeated failures and SSRF checks, and data-quality signals. **A**
9. Writing into someone else's system `integrations.writing-to-other-systems`: an idempotent create without vendor support through an external reference and a lookup before retry, mapping vendor errors, and partial results. **A**

## Module 15: Architecture (13)

The chapter is built on refactoring: most challenges hand the learner working code with the
boundary in the wrong place, and tests prove the behaviour is unchanged after the move.
Monorepos and workspaces, cut from Tooling, live here. Consistency models and local-first
sync were cut: replica lag and reading your own writes are taught in 10 Databases and 22
System design.

1. Coupling, cohesion and information hiding `arch.coupling-and-cohesion`: what architecture and a module boundary are, coupling, information hiding, a `utils` grab bag, and refactoring a caller that reaches into another module. **E**
2. Organising a codebase `arch.project-structure`: feature folders, one entry file per module enforced by `no-restricted-imports`, and finding and breaking an import cycle. **E**
3. Monorepos and workspaces `arch.monorepos`: apps and packages in one repository, `workspace:*`, a package's `exports` as its public API, and a refactor that only moves files. **E**
4. Layers and thin handlers `arch.layers`: the domain defined, handler, domain and data layers, a component that queries the database, and moving a rule where every entry point passes it. **E**
5. Ports and adapters `arch.hexagonal`: dependency direction, ports, adapters, dependency injection, and the dependency rule, with an in-memory adapter written by the learner. **A**
6. Where the model call lives `arch.model-behind-a-port`: a language model behind a port, one adapter per provider, and evals at the boundary to judge a swap. **A**
7. Domain modelling `arch.domain-modelling`: flags refactored into a state machine, invariants in one place, and value objects. **A**
8. Monolith or services `arch.monolith-and-services`: deploys, the modular monolith, and the bill for a network boundary, including the transaction a split loses. **A**
9. Events and the outbox `arch.event-driven`: events and commands, what a message broker is, the dual write, and an outbox with a relay. **A**
10. Steps that span systems `arch.sagas-and-workflows`: the transaction that can't undo the email, a step-wise state machine, sagas with compensation, durable workflow engines with retried activities and deterministic replay, and reconciliation. **A**
11. Read models and event logs `arch.cqrs-and-event-sourcing`: read models and their lag, CQRS, and event sourcing for when history is the product. **A**
12. Serving many customers `arch.tenants`: multi-tenancy, the tenant from the session, a scoped store, and row-level security as the net. **A**
13. Recording decisions `arch.adrs-and-twelve-factor`: ADRs with context, decision and costs, trade-offs, and superseding. **E**

## Module 16: Cloud and DevOps (19)

The chapter starts at the door: what a server, the cloud and a region are, and why an app
that works on `localhost` can't be reached anywhere else. Then it follows an app from a
server to a container, a pipeline, a release with a rollback and a pager, running every
command for real. Choosing a host comes once the learner has done the jobs by hand.

1. Where your code runs `cloud.where-code-runs`: servers, the cloud and regions, `localhost` against `0.0.0.0`, the platform's `PORT`, and what deploying means. **E**
2. A Linux server `cloud.linux-server`: SSH keys, users and file modes, systemd, and a firewall. **E**
3. DNS, domains and TLS `cloud.dns-and-tls`: records, TTL and a move planned around it, and certificates that cover every name. **E**
4. Containers `cloud.containers`: images and containers, a Dockerfile for a Node app, a published port, and why a container is not a VM. **E**
5. Building images you can trust `cloud.building-images`: the layer cache, `.dockerignore` against copied `node_modules` and secrets, multi-stage builds, and tags instead of `latest`. **E**
6. Compose and multi-service systems `cloud.compose`: an API and its database together, service names, volumes, and a health check that tells the truth. **E**
7. Reverse proxies and load balancing `cloud.reverse-proxies`: TLS termination, round robin, unhealthy instances, and what sticky sessions hide. **E**
8. CI/CD pipelines `cloud.ci-cd`: a GitHub Actions workflow, environments, secrets such as model keys, and one image promoted everywhere. **E**
9. Releasing without downtime `cloud.releases`: rolling and blue-green deploys gated on health, a rollback that redeploys the last image, and migrations the old code survives. **E**
10. Logs, metrics and traces `cloud.observability`: structured logs with a request id and no personal data, metrics for latency and model tokens, and OpenTelemetry traces. **E**
11. Alerts and on-call `cloud.alerts-and-on-call`: SLOs, pages only for trouble users feel, rolling back first, and a blameless review. **E**
12. Backups and recovery `cloud.backups`: PITR, replicas, and a restore you have tested. **A**
13. Choosing where to host `cloud.hosting-models`: a VPS, a managed platform, functions or Kubernetes for three real projects, and golden paths. **E**
14. Serverless functions `cloud.serverless`: cold starts, time limits, connection exhaustion, and pricing. **A**
15. Edge functions and CDNs `cloud.edge`: what runs at the edge, and data locality. **A**
16. Scaling and cost `cloud.scaling-and-cost`: statelessness, vertical before horizontal, scaling in the order the bottlenecks appear, capacity, and the forgotten GPU on the bill. **A**
17. Trunk-based development and progressive delivery `cloud.progressive-delivery`: small merges behind feature flags, canaries, sticky percentage rollouts, and the DORA metrics. **A**
18. Infrastructure as code `cloud.infrastructure-as-code`: a server and a DNS record in code, reading a plan and its drift, state that holds secrets, and least-privilege roles. **A**
19. Kubernetes essentials `cloud.kubernetes`: deploy a service with a Deployment, a Service and probes, set resource requests, and say when a managed platform is the better choice. **A**

## Module 17: CS fundamentals (10)

These lessons are scheduled between the other modules and are not a block.

**Hands-on:** a playground races one loop, a loop in a loop and a halving loop as n grows,
then the learner fixes a slow lookup with a Set.

0. What a computer does `cs.what-a-computer-does`: trace a program from disk to process, covering CPU, memory and storage. **E**
1. Complexity `cs.complexity`: count operations and read Big-O from code. **E**
2. Arrays, lists and hash maps `cs.arrays-lists-hash-maps`: costs, collisions, and why `Map` beats a plain object. **E**
3. Recursion and the call stack `cs.recursion`: trace frames, and convert recursion to iteration. **E**
4. Searching and sorting `cs.searching-and-sorting`: binary search invariants, and sort stability. **E**
5. Data representation `cs.data-representation`: bits, integers, floating point, money, and Unicode and UTF-8. **E**
6. Trees, heaps and B-trees `cs.trees`: why databases use B-trees. **A**
7. Graphs `cs.graphs`: traversal, topological order, and dependency resolution. **A**
8. Memory and runtimes `cs.memory-and-runtimes`: stack and heap, what the garbage collector keeps, and how V8 interprets and JIT-compiles. **A**
9. Operating systems and networks `cs.os-and-networks`: processes and threads, closing file descriptors, and framing messages on a TCP byte stream. **A**

## Module 18: Python (14)

Python for someone who writes JavaScript: the new spelling, text, lists, dicts, functions as values, comprehensions, exceptions and tracebacks, files and JSON, classes, uv, type hints, and a command-line tool to finish.

1. Python, coming from JavaScript `python.first-steps`: run Python, print values, name them, format text with f-strings, and read Python's indented blocks. **E**
2. Decisions, loops and numbers `python.decisions-and-loops`: branch with if, elif and else, spot the values Python treats as false, loop with for and range, and divide without surprises. **E**
3. Text and strings `python.strings`: index and search text, clean it with string methods, and split it apart and join it back. **E**
4. Lists, tuples and slicing `python.lists-and-tuples`: change lists in place, slice any sequence, unpack tuples, and tell is from ==. **E**
5. Dictionaries and sets `python.dicts-and-sets`: look up, count and group with dicts, get, defaultdict and Counter, and use sets for fast membership. **E**
6. Functions `python.functions`: define functions with defaults and keyword arguments, accept *args and **kwargs, and avoid the mutable default trap. **E**
7. Functions as values `python.functions-as-values`: pass functions as values, write a lambda, rank with sorted, max and min by a key, and never shadow a built-in. **E**
8. Comprehensions and iteration `python.comprehensions`: build lists and dicts with comprehensions, loop with enumerate, zip, any and all, and never remove items from the list you are looping over. **E**
9. Exceptions and tracebacks `python.errors-and-files`: raise and catch exceptions, catch only what you expect, and read a traceback from the bottom up. **E**
10. Files, with and JSON `python.files-and-json`: read and write files with pathlib and with, and turn JSON into Python values and back. **E**
11. Classes and dataclasses `python.classes`: write classes with methods, keep data on self, and use dataclasses for plain data. **E**
12. Projects, packages and uv `python.projects-and-uv`: split code into modules, start a project with uv, add dependencies, run code in its virtual environment, and lint with ruff. **E**
13. Type hints `python.type-hints`: annotate functions and data, check them with a type checker, and remember that Python itself ignores them at run time. **E**
14. Build a report tool `python.report-tool`: build a command-line tool that reads a JSON file of eval results, prints a report and exits with a code CI can trust. **E**

## Module 19: Python for AI engineering (9)

The Python an AI engineer uses every day: your first model call, Pydantic at the boundary, generators and decorators, asyncio, threads and processes, pytest, FastAPI, NumPy and pandas.

1. Your first model call `pyai.first-model-call`: call a language model from Python with an SDK, and read the text, stop reason and token counts in its reply. **E**
2. Pydantic `pyai.pydantic`: check data at the boundary with Pydantic models, read validation errors, validate a model's JSON reply, and load settings from the environment. **E**
3. Generators and decorators `pyai.generators-and-decorators`: hand on a streamed reply piece by piece with a generator, and retry a failing call with a decorator. **E**
4. Async Python `pyai.asyncio`: run many model calls at once with asyncio, cap them with a semaphore, and give each one a timeout. **A**
5. Threads, processes and the GIL `pyai.threads-and-processes`: choose between asyncio, threads and processes for a job, and explain what the GIL changes. **A**
6. Testing with pytest `pyai.pytest`: write tests with plain assert, share setup with fixtures, cover cases with parametrize, and fake a model call. **E**
7. FastAPI `pyai.fastapi`: build an API with typed routes, Pydantic request models, dependencies, and a streamed model reply. **A**
8. NumPy `pyai.numpy`: work with arrays of numbers, replace loops with whole-array operations, and combine arrays of different shapes. **A**
9. pandas and notebooks `pyai.pandas`: load, filter, group and join tables of results with pandas, and explore them in a notebook. **A**

## Module 20: AI engineering (14)

Language models as a component you engineer around, in Python: how they write, prompts and context, structured output, tools, retrieval, agents, evals, failures, cost and security.

1. How LLMs work `ai.how-llms-work`: explain how a language model writes text one token at a time, why the same prompt can give different answers, and why a chat model answers instead of rambling on. **E**
2. Prompting and context engineering `ai.prompting-and-context`: write a system prompt and examples that pin down the output, and decide what goes into the model's limited context. **E**
3. Structured output `ai.structured-output-and-tools`: get JSON your code can trust from a model: ask for a schema, validate the reply with Pydantic, and retry once with the error. **E**
4. Tool use `ai.tools`: give a model tools, run the calls it asks for through checked code, and send the results back. **E**
5. Reviewing AI-written code `ai.reviewing-ai-code`: a checklist of flaw classes, applied. **E**
6. Embeddings and vector search `ai.embeddings`: turn text into vectors, compare them by cosine similarity in code, and find the passages closest to a question. **A**
7. Chunking and hybrid search `ai.chunking-and-hybrid`: split documents into overlapping chunks, and combine keyword and vector search so exact codes and paraphrases both match. **A**
8. RAG `ai.rag`: build retrieval-augmented generation end to end: retrieve, build a grounded prompt with sources, cite, and say when the answer isn't there. **A**
9. Agents `ai.agents`: build an agent loop over tools with a turn cap, keep a plan and memory in context, and know where MCP fits. **A**
10. Evals `ai.evals`: build an eval set, grade with code or a model judge, and block a release when any slice regresses. **A**
11. When model calls fail `ai.failures`: handle rate limits, timeouts, cut-off replies and refusals, and retry only what is worth retrying. **A**
12. Cost and latency `ai.production`: work out what a call costs from its usage, cut waiting with streaming, and cut cost with prompt caching and a smaller model where it's enough. **A**
13. Prompt injection and data leakage `ai.injection-and-leakage`: keep untrusted text from steering a model's actions, gate risky tools behind people, and keep secrets and personal data out of prompts and logs. **A**
14. Reasoning models and how they are trained `ai.reasoning-and-training`: explain chain of thought, test-time compute, best-of-n and voting, tree search, outcome and process reward models, and how RLHF with PPO and GRPO trains a reasoning model. **A**

## Module 21: AI systems in production (17)

The engineering around a model once it serves real users: the pipeline as a whole, deeper retrieval, classifiers and thresholds at decision points, agent harnesses, guardrails, PII, evals, prompts as code, cost, latency and failures, MCP servers, and coding agents.

1. From demo to system `aisys.demo-to-system`: read a production AI pipeline as code, say what each part guards against, and spot where a one-call demo breaks first. **A**
2. Retrieval in depth `aisys.retrieval-in-depth`: choose a chunking strategy, filter by metadata, rewrite queries, and rerank candidates before they reach the prompt. **A**
3. Classifiers at the fork `aisys.classifiers-at-the-fork`: say what a classifier is and how to get one, then answer the fuzzy question at each branch with a label and a probability, and keep the large model for writing. **A**
4. Confidence thresholds and calibration `aisys.thresholds-and-calibration`: split scores into automate, review and refuse bands, choose the cut-offs from labelled data, and check that the scores are calibrated. **A**
5. Reading documents `aisys.reading-documents`: PDFs and images as model input, native text against OCR, layout, splitting and classifying a mixed scan, extraction into a schema, and structured e-invoices parsed rather than read. **A**
6. Checking what a model extracted `aisys.checking-extractions`: validation layers from schema and business rules to cross-checks against the source text, confidence and history, with the model extracting and code calculating. **A**
7. Controlling the agent loop `aisys.agent-harness`: keep control flow in code, cap steps and spend, detect loops, and prefer a fixed workflow when the path is known. **A**
8. Guardrails and human approval `aisys.guardrails`: check inputs and outputs, gate irreversible actions behind human approval, verify grounding, and moderate content. **A**
9. PII and privacy in AI systems `aisys.pii-and-privacy`: recognise personally identifiable information, detect and redact it, keep it out of prompts, logs and eval sets, and meet GDPR duties. **A**
10. Evals in depth `aisys.evals-in-depth`: check an LLM judge against human labels, grow an eval set from production traces, compare versions pairwise, and run evals online. **A**
11. Prompts and evals as code `aisys.llmops`: version prompts with the code, gate changes in CI with evals, trace every model call, and monitor quality in production. **A**
12. Cost, latency and fallbacks `aisys.cost-and-latency`: budget tokens and milliseconds per feature, keep the cached prefix stable, route by measured quality, and fall back safely when a provider fails. **A**
13. Choosing and hosting a model `aisys.choosing-models`: frontier against open weights, the cost of self-hosting, small models, fine-tuning on corrections against prompting or RAG, routing by risk, and provider data terms. **A**
14. Building MCP servers `aisys.mcp-servers`: write an MCP server with tools, resources and prompts, return tool errors the model can act on, keep stdout clean, and never trust the caller. **A**
15. Engineering with coding agents `aisys.coding-agents`: work with agentic coding tools in a team: give them context files, keep diffs small, use tests and linters as the feedback loop, and own what ships. **E**
16. Working with a coding agent on a real repo `aisys.agent-workbench`: set up a coding agent's task so it can be checked: rules it can test, a scope contract, a verification gate, a reviewer pass and a handoff note. **A**
17. Shape the build before you code `aisys.shaping-the-build`: state the outcome and its success metric, rank the assumptions by risk, pick the smallest testable slice, and write a spec that leaves room for judgement. **A**

## Module 31: Agent engineering (15)

Systems where the model acts over many steps and tools, for a long time, with people in the
loop. It sits in Python and AI engineering after AI systems; its folder number is 31 because
it was added later. It builds on `ai.agents`, `aisys.agent-harness`, `aisys.guardrails` and
`aisys.mcp-servers` without teaching them again. Python challenges, like 20 and 21.

1. The harness around the model `agents.the-harness`: the action space, sandbox and egress, permission modes, hooks, instruction files and skills, sub-agents, and harness regressions. **A**
2. Loops that run for hours `agents.long-running-loops`: token, time and cost budgets, stall detection by result hash, self-correction and re-planning, checkpoint and resume with the tool-call id as idempotency key, generator and evaluator, and escalation. **A**
3. Context that stays sharp `agents.context-at-scale`: context rot, lost in the middle, compaction, just-in-time retrieval, trimming tool output, sub-agents for isolation, and token counting. **A**
4. Designing tools a model uses well `agents.tool-design`: consolidated against granular tools, token-efficient paged responses, actionable errors, identity from the session, the read and write split, annotations, and tool search. **A**
5. Memory that helps instead of haunts `agents.memory`: short and long term, episodic, semantic and procedural memory, file and vector stores, write policies that dedupe, update and forget, staleness checks, poisoning, and scoping. **A**
6. One agent or many `agents.orchestration`: chaining, routing, sectioning and voting, orchestrator and workers, evaluator and optimiser, handoffs, and what many agents cost. **A**
7. What an agent may touch `agents.what-an-agent-may-touch`: least privilege per tool, indirect injection through tool results, the lethal trifecta, spend limits, and an audit log. **A**
8. Designing the human's part `agents.human-in-the-loop`: approval checkpoints, risk-ranked queues, suggest, edit and accept with diffs and sources, interrupt and resume, clarifying questions, automation bias, reviewer workload, and corrections as ground truth. **A**
9. Evaluating an agent `agents.evals-for-agents`: outcome against trajectory, pass@k against pass^k, tool-call accuracy, environment-based tasks, repeated trials and variance, and red teaming. **A**
10. Watching agents in production `agents.watching-agents`: spans per step and tool, cost per run and tenant, version tags, replay, an error taxonomy of hallucination, tool misuse, loops, refusals and truncation, drift, and OTel GenAI attributes. **A**
11. Letting an agent babysit a pull request `agents.babysitting-a-pr`: a standing goal on a schedule with a done state, a budget and a stop, what the watcher may do alone, must ask about and never does (merge, deploy, loosen a check), and proving the change again after every fix. **A**
12. The agent as a system `agents.agent-as-a-system`: the seven skills of agent engineering as one map, an agent as a backend of model, tools, retrieval, state and subagents, the data flow of one request, one owner per piece of state, and typed contracts between specialist agents. **A**
13. When a part of the agent fails `agents.when-a-part-fails`: tool errors the model can act on, one layer of bounded retries with backoff and jitter, timeouts, a circuit breaker per tool, and fallbacks that tell the user the truth. **A**
14. Designing for an agent that can be wrong `agents.designing-for-uncertainty`: expectations, honest confidence with sources, a clarifying question when a guess is costly, previews and undo, and a handoff to a person. **A**
15. Debugging an agent from its trace `agents.debugging-from-a-trace`: a decision log of tools, arguments, retrieved context and reasons, a trace read to its root cause (prompt, tool contract, retrieval or code), a fix proved by replay and kept as an eval case. **A**

## Module 22: System design (12)

Design systems the way a senior engineer does: requirements and estimates first, the standard shape, caching, data stores, replication, rate limits, brokers and reliability targets, then case studies ending with an AI assistant and an AI agent.

1. A method for system design `sysdesign.the-method`: turn a vague brief into functional and scale requirements, sketch the standard shape, go deep on one part, and name failure modes before you are asked. **E**
2. Back-of-the-envelope estimation `sysdesign.estimation`: estimate requests per second, peak load, storage and bandwidth from users and behaviour, and turn a latency target into a budget. **E**
3. Caching patterns `sysdesign.caching-patterns`: choose cache-aside, read-through, write-through or write-behind, invalidate correctly, and stop a stampede. **A**
4. SQL or NoSQL `sysdesign.sql-or-nosql`: match relational, document, key-value, wide-column and graph stores to access patterns, and know how far Postgres goes before you need another. **A**
5. Replication `sysdesign.replication`: scale reads with replicas, let users read their own writes despite replica lag, and fail over without split brain. **A**
6. Rate limiting `sysdesign.rate-limiting`: implement token bucket and sliding window limits, share them across servers with Redis, and answer with 429 and Retry-After. **A**
7. Message brokers `sysdesign.message-brokers`: tell a queue from a log, key events so order holds, give each reader its own consumer group, and make consumers idempotent. **A**
8. Reliability targets `sysdesign.slos-and-telemetry`: set an SLO users feel, treat its error budget as a design input, and page on a fast burn in two windows. **A**
9. Case study: a URL shortener `sysdesign.case-url-shortener`: design a read-heavy service end to end: requirements, estimates, id generation, storage, caching, redirects and abuse. **A**
10. Case study: a news feed `sysdesign.case-news-feed`: design a feed with fan-out on write and on read, handle accounts with millions of followers, and spread hot keys. **A**
11. Case study: an AI assistant over company documents `sysdesign.case-ai-assistant`: design an AI assistant over company documents as an interview wants: requirements, given numbers, both pipelines, permissions, freshness and failure modes. **A**
12. Case study: an AI agent that takes actions `sysdesign.case-ai-agent`: design an agent that acts on people's behalf: a harness your code owns, tools sorted by risk, approval before irreversible actions, safe retries and evals. **A**

## Module 23: Problem-solving patterns (17)

The patterns behind most coding-round problems and the online-assessment training syllabus: hash maps, two pointers, sliding windows, binary search, BFS and DFS, heaps, dynamic programming, prefix sums, stacks, counting and the majority value, maximum slices, intervals and greedy choices, backtracking, divisors and exact numbers, and dependency ordering, with a method for any problem. Each pattern lesson opens with the signals that point at it and ends in JavaScript or TypeScript and Python challenges with full-size performance tests.

1. Approaching a problem `algo.approach`: ask about constraints, work a small example, state a brute force, then improve it and test the edges while saying the complexity aloud. **E**
2. Hash map patterns `algo.hash-map-patterns`: count, group and look up complements in one pass with Map and Set. **E**
3. Two pointers `algo.two-pointers`: walk a sorted array from both ends, or at two speeds, to replace a nested loop. **E**
4. Sliding window `algo.sliding-window`: keep a running window over a sequence, grow and shrink it, and solve longest and shortest subarray problems in linear time. **E**
5. Binary search patterns `algo.binary-search-patterns`: find the first position where a yes-or-no check turns true, and binary-search the answer itself when a bigger answer always works. **A**
6. BFS and DFS `algo.bfs-and-dfs`: traverse grids and graphs, find shortest paths in unweighted graphs with BFS, and count connected regions with DFS. **A**
7. Heaps and top k `algo.heaps-and-top-k`: picture a binary heap as an array, keep the top k items in O(n log k), and use a heap library such as Python's heapq. **A**
8. Dynamic programming `algo.dynamic-programming`: spot overlapping subproblems, memoise a recursion, and turn it into a table filled bottom up. **A**
9. Prefix sums `algo.prefix-sums`: answer any range-sum question in constant time after one pass, and apply many range updates at once with a difference array. **E**
10. Stacks and the monotonic stack `algo.stacks-and-queues`: check nesting with a stack, find the next larger item for every position in one pass, and avoid the slow end of a JavaScript array. **E**
11. Counting and the majority value `algo.counting-and-leaders`: count with an array or a map instead of sorting, find the smallest missing number in one pass, and find a majority value with a verified candidate. **E**
12. Maximum slice `algo.maximum-slice`: find the best contiguous run in one pass by carrying the best slice ending here, and carry the right running value for variants such as one buy and one sale. **A**
13. Intervals and greedy choices `algo.intervals-and-greedy`: sort intervals to merge them or count overlaps, and argue why a greedy choice is safe before you trust it. **A**
14. Backtracking `algo.backtracking`: generate subsets, orders and combinations by choosing, exploring and undoing, and prune branches that cannot succeed. **A**
15. Divisors and exact numbers `algo.number-tricks`: loop only to the square root when a task is about divisors, and keep JavaScript numbers exact past 2^53 and through a negative remainder. **A**
16. Dependencies: topological sort `algo.dependencies`: order tasks that depend on each other with Kahn's algorithm, run independent ones in stages, and detect when a cycle makes any order impossible. **A**
17. A full coding round `algo.mock-round`: solve one problem end to end under interview conditions, from constraints to tested, optimised code, explained aloud. **A**

## Module 24: Atlas (8)

The languages and platforms beyond the web, taught through what a web and AI engineer does
there: read the code, choose a route with reasons, and ship safely. Decisions are scored in a
live table playground, not by hand.

1. Beyond the web `atlas.language-landscape`: what a platform is, native against cross-platform, static and dynamic typing, and scripts that need a runtime against binaries that don't. **E**
2. Who cleans up `atlas.memory-and-cleanup`: reference counting, garbage collection and Rust's ownership, and closing connections and files on a known line. **E**
3. Choosing a language `atlas.what-suits-what`: hard constraints first, then libraries and the team, model SDKs beyond Python, and WebAssembly for heavy code in the browser. **E**
4. Web, cross-platform or native `atlas.one-product-three-platforms`: device APIs as hard limits, a weighted decision with the weights set first, and what a store costs. **A**
5. PWAs: websites that work offline `atlas.pwas`: service workers, caching strategies, the manifest, and the iPhone's limits. **A**
6. Cross-platform apps `atlas.cross-platform`: React Native with Expo, Flutter, Kotlin Multiplatform and Capacitor, over-the-air updates, and keeping a model API key on the server. **A**
7. Native apps and the stores `atlas.native-ui`: SwiftUI and Compose read as React, signing keys, store review and phased roll-outs, and comparing app versions as numbers. **A**
8. Desktop apps: Electron and Tauri `atlas.desktop-apps`: the main process and the page, preloads instead of Node in the page, safe links, and Tauri's system web view. **A**

## Module 25: Interviews and career (8)

Prepare for senior AI engineering interviews: what each round tests, your introduction, behavioural stories, how you work with AI, the take-home, your questions, the offer and your first 90 days.

1. The senior AI engineering loop `career.interview-loop`: know what each round of a senior AI engineering loop tests, and turn a mid-level answer into a senior one. **E**
2. Tell me about yourself `career.your-narrative`: give a one-minute introduction that fits the role, and explain a gap or a career change plainly. **E**
3. Behavioural stories `career.behavioural-stories`: turn your past work into STAR stories centred on your decision and its result, and keep a bank of five. **E**
4. How you work with AI `career.how-you-work`: answer how you use AI tools, what you'd need to ramp up on, and what's changed lately, each backed by your own work. **E**
5. The take-home task `career.take-home`: know how a reviewer judges a take-home, and hand in work that runs, fails gracefully and explains its decisions. **E**
6. Questions to ask them `career.questions-to-ask`: ask each interviewer questions that show how the team really builds AI, and read the warning signs in their answers. **E**
7. The offer `career.the-offer`: compare offers like for like, and ask for a better one politely, with a specific number and a reason. **E**
8. The first 90 days `career.first-90-days`: plan your first three months in a new team, learn a codebase by tracing one request, and ship a small first change. **E**

## Module 26: Clean code (10)

Code that other people can read, change and trust: names, small functions, flat control flow, honest comments, clean error handling, the right amount of abstraction, pure cores, code smells, design principles in proportion, and review. Its lessons are woven into the journey, each after the lesson it builds on.

1. Names that explain `clean.naming`: choose names that reveal intent, keep one word per idea, name booleans as questions, and match a name's length to its scope. **E**
2. Small functions that do one thing `clean.functions`: split functions to one job and one level of abstraction, keep parameter lists short, replace flag arguments, and separate commands from queries. **E**
3. Flat control flow `clean.control-flow`: flatten nested conditions with guard clauses and early returns, drop else after return, and replace long if chains with lookup tables. **E**
4. Comments, constants and dead code `clean.comments-and-constants`: write comments that explain why, name magic values as constants, and delete dead and commented-out code. **E**
5. Handling errors cleanly `clean.errors`: fail fast on bad input, never swallow errors, throw specific error types, and decide where each error is handled. **E**
6. Pure core, effects at the edges `clean.side-effects`: keep business logic in pure functions, push I/O and time to the edges, and avoid hidden shared state. **A**
7. Code smells and refactoring moves `clean.code-smells`: recognise common smells, apply the matching refactoring move, and refactor safely under tests. **A**
8. Duplication and the wrong abstraction `clean.duplication`: tell duplicated knowledge from look-alike code, wait for the rule of three, and undo an abstraction that has grown flags. **A**
9. Design principles in proportion `clean.design-principles`: apply SOLID, KISS, YAGNI and composition over inheritance where they help, and notice when they make code worse. **A**
10. Reviewing code like a senior `clean.code-review`: review in order of what matters, write comments that are clear about severity, and keep changes small enough to review well. **A**

## Module 27: Code like a pro (9)

What makes code look professional rather than amateur, language by language: the amateur tells, idiomatic JavaScript, TypeScript, Python, production Python, React, SQL, HTML and CSS, and commits and pull requests. Its lessons are woven into the journey, each after the lesson it builds on.

1. Amateur tells `pro.amateur-tells`: spot the signs that give amateur code away, such as leftover logs, vague names, inconsistency and copy-paste, and clean them up. **E**
2. Idiomatic modern JavaScript `pro.modern-javascript`: write JavaScript the way experienced developers do: destructuring, spread, array methods where they read better, async and await, and named exports. **E**
3. HTML and CSS like a pro `pro.css-and-html`: write semantic HTML and maintainable CSS: tokens instead of magic values, low specificity, no !important, and logical properties. **E**
4. TypeScript like a pro `pro.typescript`: let inference work, keep config precise with satisfies, brand ids, and never cast outside data. **E**
5. React like a pro `pro.react`: derive values instead of syncing state, keep effects for the outside world, draw component boundaries well, and name hooks clearly. **A**
6. SQL like a pro `pro.sql`: write readable, set-based SQL: explicit columns, CTEs, consistent formatting, NULL-safe logic and parameters. **E**
7. Pythonic Python `pro.pythonic`: write Python the way Python developers expect: EAFP, comprehensions, unpacking, context managers, logging instead of print, and the standard library first. **E**
8. Production-grade Python `pro.production-python`: structure a Python project for a team: src layout, strict type checking in CI, and structured JSON logs without secrets. **A**
9. Commits and pull requests like a pro `pro.commits-and-prs`: make atomic commits with clear messages, write pull request descriptions reviewers can act on, and keep a useful README. **E**

## Module 28: Interview challenges (29)

The coding challenges senior full-stack and AI engineers meet: timed online tests with hidden scoring, practical feature and component rounds, AI builds, AI-assisted rounds, and a four-hour build you present to a panel. Lessons 24 to 27 are timed assessments scored on hidden correctness and performance tests. The research is in `docs/INTERVIEWS.md`.

1. The assessment landscape `interview.landscape`: tell the six kinds of coding round apart, know how each is scored, and ask the recruiter the questions that change your preparation. **E**
2. Online assessments inside out `interview.online-assessments`: work the way a hidden-test scorer rewards: read the complexity line, test your own cases, and never submit code that does not compile. **E**
3. Reading the task statement `interview.reading-the-task`: read a task statement the way the hidden tests will: the constraints, the complexity hint, the exact output format and the special cases. **E**
4. JavaScript traps under time `interview.js-traps`: avoid the JavaScript habits that pass small examples and fail large hidden tests: string sorting, shift in loops, spread on huge arrays and deep recursion. **E**
5. Strategy for a timed set `interview.timed-strategy`: split a timed set sensibly, bank partial credit with a brute force, and find your own bugs by stress testing against it. **E**
6. Bug-fix and refactor rounds `interview.bug-fix-round`: read unfamiliar code before changing it, fix a bug in the fewest lines, and refactor in small steps that keep tests green. **E**
7. Live-coding communication `interview.communication`: run a live round out loud: a steady script, checkpoints instead of commentary, framed silence and hints taken well. **E**
8. LRU cache and event emitter `interview.utilities`: write the two classes live utility rounds ask for most, an LRU cache on a Map and an event emitter with on, off and once. **E**
9. Debounce and throttle `interview.debounce-throttle`: write debounce and throttle that are right at the edges, and test them in an instant with an injected clock. **E**
10. Levelled task, part one `interview.levelled-one`: build the first two levels of an in-memory database so the later levels do not force a rewrite. **A**
11. Levelled task, part two `interview.levelled-two`: add expiry by timestamp and backup and restore to the store, keeping the earlier levels green. **A**
12. A key-value store with transactions `interview.transactions`: support begin, commit and rollback, including nested transactions, with a stack of change sets. **A**
13. The backend round `interview.backend-round`: write a request handler that validates input, paginates with a cursor, returns one error format and honours an idempotency key. **A**
14. The frontend round `interview.frontend-round`: get the state of an autocomplete right: latest request wins, every loading and error state, keyboard navigation and the combobox pattern. **A**
15. The component round `interview.component-round`: build tabs, a dialog, a star rating and a dropdown in plain HTML, CSS and JavaScript that work with a mouse, a keyboard and a screen reader. **A**
16. The component round in React `interview.react-component-round`: build the same widgets as React components with a clear interface, effects that clean up and focus that goes where people expect. **A**
17. AI-assisted rounds `interview.ai-assisted`: use an assistant in an interview the way reviewers reward: plan first, prompt small, verify everything and own every line. **E**
18. Evals first `interview.evals-first`: start an AI build with a small golden set, measure retrieval and answers separately, and gate changes on the results. **A**
19. AI build: RAG with citations `interview.rag-build`: build retrieval-augmented answers end to end: chunk with overlap, retrieve the top matches, cite sources and refuse when the context is not enough. **A**
20. AI build: an agent with guardrails `interview.agent-build`: write a tool loop with a step cap, an allowlist, approval before write actions and validated, retried structured output. **A**
21. AI build: streaming chat `interview.streaming-build`: turn a stream of text and tool-call deltas into chat state, and handle cancel and a failure halfway through. **A**
22. The four-hour build `interview.four-hour-build`: turn a brief into a scoped plan, ship a thin working slice first, and leave time for tests and a README that shows your thinking. **E**
23. Presenting your build `interview.presenting`: present a build in ten to fifteen minutes around your decisions, demo one path safely, and answer hard follow-up questions well. **E**
24. Mock assessment A `interview.mock-a`: sit a timed three-task assessment scored on hidden correctness and performance tests. **A**
25. Mock assessment B `interview.mock-b`: sit a second timed three-task assessment on different patterns. **A**
26. Full mock 4: one task in four levels `interview.mock-levelled`: sit a timed four-level task that grows a bank system, keeping every earlier level passing. **A**
27. Mock assessment C, in Python `interview.mock-python`: sit a timed three-task assessment in Python, scored on hidden correctness and performance tests. **A**
28. AI build: a production LLM client `interview.llm-client-build`: wrap a model call with a timeout, retries on retryable errors only, a concurrency cap, a promise cache that shares identical calls, and JSON validated with one re-ask. **A**
29. Tasks candidates report `interview.reported-tasks`: name the pattern behind ten commonly reported online-test tasks and solve three of them. **A**

## Module 29: Next.js on the server (4)

These lessons are woven into the journey, each after the backend, database or cloud lesson it
builds on.

**Lab: Cache-Layer Explorer**, which shows where a request is served from and what each
revalidation call reaches.

1. Route handlers `nextserver.route-handlers`: a JSON endpoint in a `route.ts` file, answering bad input with a `400`, and what `proxy.ts` is for. Woven after validation. **E**
2. Server Actions `nextserver.server-actions`: a form that saves through a `'use server'` function, checked inside for the caller, every field and ownership. Woven after authorisation. **E**
3. Caching pages and data `nextserver.caching`: `'use cache'`, `cacheLife`, refreshing with `cacheTag` and `updateTag`, and the copy in the browser. Woven after reading `EXPLAIN`. **E**
4. Deploying a Next.js app `nextserver.deploying`: `next start`, standalone output and its missing static files, and what a managed host does for you. Woven after reverse proxies. **A**

## Module 32: Engineering judgment (12)

Knowing what to verify: what breaks, what scales, what confuses the next reader, what leaks
and what a change could regress, then pressure-testing designs, making the call, ranking
work and drawing workflows. Its lessons are woven into the journey, each after the lesson it
builds on, and later lessons refer back to its five questions.

1. What to check before you trust code `judgment.what-to-verify`: the five questions (what breaks, what scales, what confuses, what leaks, how you'd prove it) applied to an AI-written diff. Woven after working with AI. **E**
2. Finding what breaks `judgment.what-breaks`: inputs from outside, partial failure, boundaries and time, listing failure modes and picking the test that matters. Woven after what to test. **A**
3. Will it hold at 10x? `judgment.what-scales`: unbounded lists, N+1 queries, hot paths and quick estimates, spotting the line that dies at ten times the load. Woven after backpressure. **A**
4. What confuses the next person `judgment.next-reader`: surprise, hidden invariants, implicit contracts and misleading names, fixing the surprise rather than the style. Woven after code review. **A**
5. Following the data `judgment.what-leaks`: tracing a field through logs, errors, URLs, caches, analytics and prompts to find the leak. Woven after defence in depth. **A**
6. What could this change break? `judgment.regressions`: blast radius, callers and contracts, characterisation tests, and choosing regression tests. Woven after contract tests. **A**
7. Pressure-testing a design `judgment.pressure-testing`: a pre-mortem, a light failure-mode table, a steelman, an adversarial review, and what breaks at 10x. Woven after the system design method. **A**
8. Making the call `judgment.trade-offs`: build or buy, boring technology, one-way and two-way doors, and the rule of three. Woven after recording decisions. **A**
9. From intent to a ranked list `judgment.intents-and-priorities`: jobs to be done, intent mapping, impact and effort, MoSCoW, RICE and non-goals. Woven after shaping the build. **A**
10. Drawing the workflow `judgment.workflows-on-paper`: swimlanes for people, AI and system, then sequence and state diagrams in Mermaid, with failure paths. Woven after intents and priorities. **A**
11. Reviewing a whole change `judgment.reviewing-a-change`: an end-to-end review of an AI-written pull request for security, efficiency, regressions and tests, explaining the verdict, and deep-reading the trunk while gating the leaves. Woven after coding agents. **A**
12. Merge ready is not launch ready `judgment.ready-to-launch`: independent agents attack the whole product before launch (features, bugs, performance, security), and the launch goes out as an experiment with guardrails and a tested way back. Woven after babysitting a pull request. **A**

## Module 33: Explaining your work (8)

Saying things so people understand them. Short, light lessons that lean on saying it out
loud. Its lessons are woven into the journey, each after the lesson it builds on. Pull
requests stay with `pro.commits-and-prs`, and interview talk with `interview.communication`
and `interview.presenting`; these lessons link to them instead of repeating them.

1. Saying it plainly `explain.say-it-plainly`: the point first, one idea at a time, the example before the term, and checking they followed. Woven after a small program. **E**
2. Asking a question people can answer `explain.asking-for-help`: expected against actual, a minimal reproduction, and what you tried. Woven after errors. **E**
3. Walking someone through code `explain.walking-through-code`: intent before mechanics, one path at a time, and the why. Woven after small functions. **E**
4. Explaining a decision `explain.explaining-a-decision`: options, criteria, a recommendation, and what would change your mind. Woven after monolith or services. **A**
5. Same idea, different listeners `explain.audiences`: a junior developer, product, a customer and an executive, with the vocabulary, detail and stakes each needs. Woven after incident response. **A**
6. Writing an incident update `explain.incident-updates`: impact, status, the time of the next update, and no blame. Woven after alerts and on-call. **A**
7. A one-page design doc `explain.design-docs`: problem, goals and non-goals, options, decision, rollout and risks. Woven after making the call. **A**
8. Talking through a diagram `explain.talking-through-a-diagram`: the order of the boxes, narrating the data flow, and marking the failure points. Woven after drawing the workflow. **A**

## Added beyond the first topic list

- reading `EXPLAIN`
- connection pooling under serverless
- the outbox pattern and sagas
- fencing tokens
- load shedding and waiting rooms
- property-based and concurrency tests
- mutation testing
- SLOs
- tested restores
- a cost model
- passkeys
- supply chain hygiene
- privacy and GDPR
- the V8 pipeline
- three.js render performance
- domain state machines
- multi-tenancy

## Other languages

There are no tracks. Everything is taught inside the one course, and Python already is
(modules 18 and 19). Go, Swift and Kotlin would be added as modules when they are wanted, in
the same folder and the same journey.
