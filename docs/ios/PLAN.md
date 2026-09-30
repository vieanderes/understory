# The iOS app

Decisions with their reasons, in the shape of `docs/ARCHITECTURE.md`. The web app is the
reference implementation. Everything that is a rule rather than a screen already lives in
`src/core`, is written down in `docs/LEARNING-SCIENCE.md`, and is pinned by
`contracts/fixtures`. The iOS app reproduces those rules exactly and adds nothing to them.

## Goals

- One learner, two devices, the same numbers. Mastery, attempt score, XP, the weekly goal,
  ranks and calibration are derived from the same event log on both, and the Swift reducer
  passes the same golden fixtures the TypeScript reducer wrote.
- A phone-shaped version of the core loop: read, predict, trace, arrange, hunt, write,
  explain, recall. Not a smaller web page in a wrapper.
- Practice that works on the train: everything the learner needs for a ten minute session
  is on disk before they open the app.
- Accessible first. Dynamic Type at every size, VoiceOver through every step type, and the
  drag-and-drop steps usable with no drag.
- No account, no tracking, no third-party SDK.

## Non-goals

- No lesson authoring on device. Content is built in the web repo and fetched.
- No labs in version one. Every `lab` step carries a portable `fallback`, so a lesson is
  whole without the widget.
- No Signal editing, no news fetching on device. Signal is read-only.
- No watchOS, no Vision Pro, no Mac Catalyst build in version one.
- No login. Sync arrives with `docs/SYNC-PROTOCOL.md` and not before; export and import of
  the web app's own JSON file bridges the gap.
- No AI features on device.

## Decisions

| #   | Decision                               | Choice                                                                                                                                                                                                                                                                                                | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Framework                              | SwiftUI, one codebase for iPhone and iPad, with UIKit reached for through `UIViewRepresentable` where it is genuinely better.                                                                                                                                                                         | The screens are lists, forms, cards and text. SwiftUI does those in a fraction of the code and gets Dynamic Type, VoiceOver and the system's own motion settings without asking. The three places it is weak, a code editor, a long document and precise drag, are exactly where D7 reaches for UIKit.                                                                                                                                                                      |
| D2  | Concurrency                            | Swift 6 language mode, strict concurrency on from the first commit. `UnderstoryKit` is Foundation only and every public type is `Sendable`.                                                                                                                                                           | The domain is already value types and pure functions, so the cost of strict checking is near zero now and very high later. It also lets the same package link into a widget and an App Intents extension with no `@MainActor` leaking through.                                                                                                                                                                                                                              |
| D3  | Minimum iOS                            | iOS 26.                                                                                                                                                                                                                                                                                               | Liquid Glass shipped in iOS 26 and is not backportable. Supporting iOS 18 as well would mean two navigation chromes, two sets of screenshots and two accessibility audits for an app with no users yet. The app is new, so there is no installed base to strand. Revisit if adoption stalls.                                                                                                                                                                                |
| D4  | Native, not React Native or a web view | A native Swift app on a shared data contract.                                                                                                                                                                                                                                                         | The two hard things to share, content and rules, are already platform-neutral: JSON in `public/content/v1` and an event log with golden fixtures. What is left to share is UI, and that is the part that should not be shared, because the phone's answer to a Parsons problem is drag, not a list of buttons. A web view would also drag the whole CodeMirror and Sucrase bundle onto a device that has a better editor and a JavaScript engine already.                   |
| D5  | Event log storage                      | A flat append-only file of JSON lines, plus a derived-state cache keyed by `reducerVersion`. Not SwiftData, not GRDB.                                                                                                                                                                                 | Sync is a set union by event id and the reducer is order-insensitive (`docs/SYNC-PROTOCOL.md`). Union-merge wants an append-only log, not a mutable object graph; SwiftData's model is rows you edit, which is the wrong shape and brings a migration story for data that is never edited. GRDB would be the right answer if we queried the log, but we do not: we fold it. The whole log for a year of daily practice is well under a megabyte. See the sizing note below. |
| D6  | Content bundle                         | Fetched from the web origin. `manifest.json` short-cached, every lesson and solutions file immutable behind a content hash, cached on disk. A starter snapshot ships inside the app.                                                                                                                  | The manifest is the only file that has to be re-fetched to learn what changed, because every other path carries a 12-character hash. That makes the disk cache trivially correct: a file whose name matches is the right file for ever. The bundled snapshot means the first launch works on aeroplane mode and the App Store review copy is never empty.                                                                                                                   |
| D7  | Learner code                           | JavaScriptCore with `public/sandbox/harness.v1.js` for js, ts and tsx (tsx adds the committed React runtime and host timers). Python, with its packages and async tests, in a hidden `WKWebView` with Pyodide. Playgrounds and SQL in web views too (D11, D12). See D8 and docs/SANDBOX.md, "On iOS". | The harness is deliberately DOM-free and loads into JavaScriptCore unchanged, so the verdict on the phone is the verdict in the browser. One harness, one set of assertion messages, one CI gate.                                                                                                                                                                                                                                                                           |
| D8  | Stripping TypeScript                   | Superseded: the web's Sucrase ships on device, bundled into `sucrase.v1.js` (289 KB) by `Scripts/build-resources.ts`.                                                                                                                                                                                 | Precompiling covers starter code and tests but not what a learner types, which is the input that matters. The bundle is the installed package, called with the web's options, so the output is the web's. Loading it takes about 55 ms once per process on a Mac.                                                                                                                                                                                                           |
| D9  | Stopping a runaway loop                | A `WKWebView` running the same harness for anything a learner typed, with JavaScriptCore kept for work the app controls.                                                                                                                                                                              | Measured, not assumed: `JSContextGroupSetExecutionTimeLimit` is exported by the JavaScriptCore binary on both SDKs but declared in no public header, so it is private API. `WKWebView` has a supported watchdog. Detail below.                                                                                                                                                                                                                                              |
| D10 | FSRS                                   | Card state travels inside the `review_graded` event. The device that graded the review computed it; no other device ever replays FSRS.                                                                                                                                                                | This is the one place floating-point differences between TypeScript and Swift could make two devices disagree, and the protocol already removes it. What Swift does implement is the forgetting curve, because mastery decays and has to be computed at the moment of looking. It is pinned to values printed from the TypeScript.                                                                                                                                          |
| D11 | Playgrounds                            | `PlaygroundPreview`: the page in a `WKWebView` on screen, built and judged by the web's own `src/core/playground` and `gradePlayground`, bundled as `core-kit.v1.js` and called through JavaScriptCore (`CoreKit`).                                                                                   | A playground is a page, and WebKit is a browser, so the page is drawn exactly as Safari draws it and a computed style or a layout is the real one. Porting the page builder, the probe or the reasons to Swift would make a second definition of "passed"; calling the bundle makes the phone's verdict the web's by construction. Proven on every scored playground of the bundle (docs/SANDBOX.md, "Playgrounds on iOS").                                                 |
| D12 | SQL                                    | `SqlRunner`: the web's SQL worker and `WorkerSqlEngine` in a hidden `WKWebView`, PGlite's wasm downloaded once and checked (`PGliteAssetStore`), the verdict by the web's `sqlVerdict` through `CoreKit`.                                                                                             | PGlite is WebAssembly and needs the content process's JIT, as Pyodide does. Nothing is ported, so reset, splitting, text values, budgets and the comparison are the browser's. The 1 MB worker ships in the app; the 16.8 MB of data does not, since only the database lessons need it.                                                                                                                                                                                     |
| D13 | Web code on device                     | App-controlled web code (the page builder, checks, SQL verdict, Sucrase) runs in a plain `JSContext`; anything that runs learner code or WebAssembly runs in a `WKWebView`.                                                                                                                           | The same line as D9: a `JSContext` has no supported watchdog and no WebAssembly on iOS, and it is only ever handed code the app shipped. The bundles are committed and checked for staleness by `sync-resources.sh --check`.                                                                                                                                                                                                                                                |
| D14 | Honest degradation                     | `StepRuntime` (UnderstoryKit) says what a step needs on the phone: nothing, JavaScriptCore, Pyodide and which packages, a playground, or PGlite, whether types are checked, and why a step is web only.                                                                                               | A step the app cannot run is shown with one sentence and a way to the web, never graded on a guess. An unknown step type or a package the app does not ship is web only; a TypeScript `typecheck` step is graded on its tests and says types are not checked, which is what the web does when its checker is not there; a runtime that fails to load is `unavailable` and records no grade, as on the web.                                                                  |

### Sizing note for D5

A busy day is about forty events. A year of that is 15,000 events at roughly 300 bytes
each, so 4.5 MB before compression. Folding 15,000 events takes single-digit milliseconds
in the Swift reducer, which is why the cache is a convenience and never the truth. If the
log ever outgrows this, the change is to snapshot the fold every thousand events, not to
move to a database.

### D8 in full: TypeScript on device

| Option                                              | What it costs                                                                                                                                         | Verdict                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Bundle Sucrase into JavaScriptCore                  | About 1 MB of JavaScript to parse on first use, a second copy of a transpiler to keep in step with the web's version, and a new source of divergence. | No. The device pays for something a build machine already did.                              |
| Precompile starter and tests to JS at content build | Two more fields on `code-challenge` in the compiled schema (`starterJs`, `testsJs`), written by the same Sucrase the web uses. Bundle grows slightly. | **Recommended.** Zero device cost, and the phone and the browser run byte-identical source. |
| JavaScript-only challenges                          | Free, but cuts the TypeScript module's produce items, which are the items that carry the most mastery evidence.                                       | No. It weakens the learning, not just the app.                                              |

Revisited: learner edits cannot be precompiled, so the first row won after all, at 289 KB
rather than 1 MB. `SucraseTranspiler` is the default; `PassthroughTranspiler` stays for
tests and refuses anything but js.

### D9 in full: what JavaScriptCore gives a host

Checked against Xcode 26.2 and Swift 6.2.3, and asserted in
`Tests/UnderstoryRunnerTests/JavaScriptRunnerTests.swift`:

- `JSContextGroupSetExecutionTimeLimit` and `JSContextGroupClearExecutionTimeLimit` are
  exported by the JavaScriptCore binary on macOS and iOS. They are declared in no public
  header of either SDK.
- Resolved through `dlsym` they work exactly as documented in WebKit's source: the callback
  fires at the deadline, returning `true` terminates, and the host sees a
  `TerminatedExecutionError`. Under `swift test` on macOS an endless `while (true) {}` is
  stopped in about 300 ms against a 500 ms budget, and output written before the loop
  survives. `UnderstoryRunner` uses them when they resolve, which is what makes the timeout
  tests real.
- The Objective-C API has no equivalent, so without that private symbol a host can only
  stop waiting for a run, not stop the run. The thread keeps spinning until the process
  ends.
- Private API is not shippable. So the plan is D9: anything the learner typed runs in a
  `WKWebView` loading the same `harness.v1.js`, which has a supported watchdog and is what
  the web app already trusts; `UnderstoryRunner` on JavaScriptCore stays for grading fixed
  content the app controls, and for the test suite.

## Module layout

```
ios/
  UnderstoryKit/                  Swift package, no third-party dependencies
    Sources/UnderstoryKit/        Foundation only. Links into the app, the widget and the
      Content/                    App Intents extension alike.
      Progress/                   Events, upcasters, the reducer, the read model
      Mastery/                    Attempt score, P, M, mastery, states, difficulty
      Gamification/               XP, weekly goal, ranks, calibration
      Scheduling/                 The forgetting curve, due cards, rating from score
      Insight/                    Today, the map and the widget's read side
      Running/                    What a step needs on the phone, Python package scan,
                                  the editable region of a starter
      Support/                    Instants, JavaScript-exact arithmetic, open JSON
    Sources/UnderstoryRunner/     JavaScriptCore plus harness.v1.js, Pyodide, the
                                  playground preview and PGlite in web views, CoreKit.
                                  Kept apart so that extensions which never run code do
                                  not link it.
    Tests/
    Scripts/sync-resources.sh     Writes the embedded web files (build-resources.ts lists them)
    Scripts/print-reference-values.ts  Prints the values the Swift tests are pinned to
  Understory/                     The app target (not yet written)
    App/                          Entry point, routing, deep links, scene handling
    DesignSystem/                 Generated tokens, type styles, components
    Features/Today|Learn|Practise|Map|Signal|Settings
    Features/LessonPlayer/Steps/  One view per step type
    Storage/                      The event log file, the content cache, the snapshot
    Widgets/                      WidgetKit and Live Activity
    Intents/                      App Intents
```

`UnderstoryKit` never imports SwiftUI. The app never reimplements a rule.

## Navigation and screens

A `TabView` on iPhone with five tabs: Today, Learn, Practise, Map, Signal. Settings is
reached from Today's top-right, as on the web, because it is not a daily place. Two screens
are full-screen and hide the tab bar, matching the web's `(focus)` routes: the lesson player
and the practice session.

On iPad the same five places become a `NavigationSplitView`: the sidebar holds the places,
the content column holds the list, and the detail column holds the lesson or the day. In the
lesson player the split is used for its real purpose: code on the left, question on the
right, which is exactly what the web does from `md` upward.

| Place    | Web route                     | iOS container                                                       |
| -------- | ----------------------------- | ------------------------------------------------------------------- |
| Today    | `/`                           | `NavigationStack` inside the first tab                              |
| Learn    | `/learn`                      | `NavigationStack` with a `List` of modules, one section per chapter |
| Lesson   | `/learn/<module>/<lesson>`    | `.fullScreenCover`, its own `NavigationStack`, tab bar hidden       |
| Practise | `/practise`                   | `NavigationStack`                                                   |
| Session  | `/practise/session/<minutes>` | `.fullScreenCover`                                                  |
| Map      | `/map`                        | `NavigationStack`, `ScrollView` with a `Grid`                       |
| Signal   | `/signal`, `/signal/<date>`   | `NavigationStack`, list to detail                                   |
| Settings | `/settings`                   | `NavigationStack` presented as a sheet                              |

Full wireframes are in `SCREENS.md`.

## Every step type on a phone

The rule in all of them: nothing may need a drag, a hover or a keyboard to be answerable.

| Step              | Native interaction                                                                                                                                                                                                            | Accessibility                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prose`           | `Text(AttributedString(markdown:))` from the step's `md`. Code fences in a horizontally scrollable mono block.                                                                                                                | Standard text. Code blocks get `.accessibilityLabel` naming the language.                                                                                                   |
| `predict-output`  | Code block, then choices as full-width buttons. Feedback expands under the chosen answer.                                                                                                                                     | Buttons carry `.isButton`; the chosen one gains `.isSelected`. Feedback is announced with `AccessibilityNotification.Announcement`.                                         |
| `multiple-choice` | The same control, with the code block optional.                                                                                                                                                                               | As above.                                                                                                                                                                   |
| `trace-table`     | A `Grid` of cells. Tapping a cell opens a keyboard with a custom accessory row carrying the values seen so far in this table, `undefined`, `NaN`, quotes and brackets.                                                        | Each cell labelled "row 3, column total, empty". Rotor entry per row. The accessory row is a `Toolbar` with `ToolbarItemGroup(placement: .keyboard)`.                       |
| `fill-blank`      | The template rendered with inline blank chips. Tapping a blank opens the token bank as a bottom sheet; tapping a token fills the blank and moves to the next.                                                                 | Blanks are buttons labelled "blank 2 of 4, empty". The bank is a list, not a grid, for VoiceOver.                                                                           |
| `parsons`         | Native drag and drop between two lists, plus tap-to-pick: tap a line in the bank, tap the slot it goes in. Indentation by a horizontal drag or by two stepper buttons on the focused row.                                     | Every row exposes `accessibilityActions`: move up, move down, indent, outdent, remove. So the whole step works with no drag at all. The rotor gets a custom "lines" entry.  |
| `bug-hunt`        | Lines are tappable. A tapped line stays marked; then the reasons appear as buttons.                                                                                                                                           | Each line is a button labelled "line 7, `const total = a + b`". Selected lines gain `.isSelected`.                                                                          |
| `ai-review`       | The same, with the request shown above the code in a quoted block.                                                                                                                                                            | The request block is labelled "what the assistant was asked".                                                                                                               |
| `code-challenge`  | A TextKit 2 editor in a `UIViewRepresentable`, with a symbol bar above the keyboard: tab, brackets, quotes, arrow, semicolon, and undo. Run is the primary action. Hints are a ladder.                                        | The editor is a real `UITextView`, so VoiceOver, Braille and text selection work. The symbol bar buttons are labelled by name, not by glyph.                                |
| `explain-back`    | A plain multi-line text field, then the model answer, then the three rubric checkboxes.                                                                                                                                       | The rubric is a `List` of toggles. The self-grade is announced as "two of three".                                                                                           |
| `lab`             | Not in version one. The compiled `fallback` step is played instead.                                                                                                                                                           | Whatever the fallback needs.                                                                                                                                                |
| `incident`        | Not in version one. Same fallback rule.                                                                                                                                                                                       | As above.                                                                                                                                                                   |
| `playground`      | A segmented control for the editable fields, the editor, and the live preview (`PlaygroundPreview.webView`) under it on iPhone and beside it on iPad, redrawn 250 ms after typing stops. The checklist ticks from `onReport`. | The preview is labelled "Preview". The checklist is a `List` with each item's state and reason; changes are announced once, after the page settles, not on every keystroke. |
| `sql`             | The editor, Run as the primary action, the result tables in a horizontal scroll view, and the schema from `SqlRunner.schema(of:)` in a disclosure group.                                                                      | Each table is a `Grid` with column headers as headers; an error names its line. "Loading the database" is announced while PGlite starts.                                    |
| Recall card       | Front, a Show button, back, then four rating buttons.                                                                                                                                                                         | Rating buttons say "Again", "Hard", "Good", "Easy" and carry a hint of when the card returns.                                                                               |

Across all of them:

- **Dynamic Type.** Every size from xSmall to AX5. Above AX3 the lesson player drops to one
  column on iPad and the code block gets its own scroll view. No fixed heights.
- **VoiceOver.** Custom rotor entries for lesson steps, for lines of code and for Parsons
  lines. Every step announces its position ("step 4 of 12") when it becomes visible.
- **Reduced motion.** `@Environment(\.accessibilityReduceMotion)` removes step transitions
  and the mastery map's fade, leaving a cross-dissolve. Nothing is only conveyed by motion.
- **Haptics carry information only.** One `.success` on a correct answer, one `.warning` on
  a wrong one, one `.impact(.soft)` when a Parsons line snaps into a slot. Never for
  arriving on a screen, never for XP, never repeated. Off follows the system setting.

## Code on the phone

What runs where, and what the app does when it cannot (D7, D11 to D14). `StepRuntime` in
UnderstoryKit is the lesson player's one question: what does this step need here?

| Step                                                          | Runs in                                          | Grading                                         | Downloaded on first use                                            |
| ------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| js, ts, tsx challenge                                         | JavaScriptCore, the shared harness               | The harness's report                            | Nothing                                                            |
| ts challenge with `typecheck`                                 | The same                                         | Tests only; the step says types are not checked | Nothing                                                            |
| Python challenge                                              | `WKWebView`, Pyodide worker, `run_async`         | The Python harness's report                     | Pyodide 13.2 MB                                                    |
| Python with packages                                          | The same, wheels loaded before the budget starts | The same                                        | numpy 2.9 MB, pandas 9.0 MB with its dependencies, pydantic 1.8 MB |
| `playground` (HTML, CSS, JS)                                  | `WKWebView` on screen, the web's page and probe  | The web's `evaluateChecks`, `gradePlayground`   | Nothing                                                            |
| `playground` with `jsx`                                       | The same, React 19 inlined, Sucrase on device    | The same                                        | Nothing                                                            |
| `sql`                                                         | `WKWebView`, the web's PGlite worker             | The web's `sqlVerdict`, `gradeSql`              | PGlite 16.8 MB                                                     |
| A step type the app does not know, a package it does not ship | Nothing                                          | None; the step offers the web                   |                                                                    |

What the app carries for this: `core-kit.v1.js` 211 KB, `react-playground.v1.js` 420 KB,
`sql-host.v1.js` 192 KB and `sql-engine.v1.js` 1 MB, beside the harness, the React test
runtime and Sucrase. What fails at run time (no network before the first download, a
checksum that does not match, a page that stops answering) ends as `SandboxError` for a
challenge or `unavailable` for sql, both with a sentence; the player shows
`StepRuntime.openOnWeb(because:)` and records no grade.

## Design system translation

- **Tokens are generated, not retyped.** A build script reads `src/styles/tokens.css` and
  emits a Swift file of semantic colours and an asset catalogue with light and dark values.
  The names stay the same: `bg`, `surface`, `sunken`, `fg`, `muted`, `faint`, `border`,
  `accent`, `accentFg`, `accentTint`, `success`, `warning`, `danger`, plus the syntax
  colours. No view names a literal colour, exactly as on the web.
- **The identity is still open.** Two identities are live at `/design/a` and `/design/b`
  (`docs/DESIGN.md`). The generator takes the identity as an argument and writes one asset
  catalogue per identity, so choosing between them is a one-line change and a rebuild. Do
  not hand-write a single colour before that choice is made.
- **Four sizes, mapped to Dynamic Type.** `text-sm` to `.footnote`, `text-base` to `.body`,
  `text-lg` to `.title3`, `text-xl` to `.largeTitle`. Three weights: regular, medium,
  semibold. The display face is registered as a custom font and reached only through one
  `TitleStyle` view modifier, the direct equivalent of `.t-title`. Figures use the mono face
  with `.monospacedDigit()`, matching `.t-figure`.
- **The 8 pt grid.** One `Spacing` enum with `xs` 4, `s` 8, `m` 16, `l` 24, `xl` 32,
  `xxl` 48, `xxxl` 64. Nothing takes a raw number. A unit test fails on a literal padding.
- **Liquid Glass is chrome only.** Navigation bars, tab bars, toolbars, sheets and the
  session's floating controls adopt it. Content surfaces, code blocks and the mastery map do
  not: glass over code costs contrast, and law 15 of `docs/DESIGN.md` says every text token
  reaches 4.5:1 on every ground. A test asserts no glass material sits behind body text.
- **Flat everywhere else.** No gradients, no glow, no shadow at rest, hairlines rather than
  boxes. One shadow, for things that float.

## Platform features that serve learning

Each of these exists because it shortens the path to a retrieval attempt, not because it
raises engagement. `docs/LEARNING-SCIENCE.md` principle 14 rules out streaks and loss framing.

| Feature          | What it does                                                                                                             | Why it is not engagement bait                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| WidgetKit widget | Small: the due count and the next due date. Medium: adds the three concepts nearest forgetting.                          | It reports a schedule the learner cannot rush. Nothing counts up, nothing is at risk.                              |
| Live Activity    | While a session runs: minutes left, items done, items left. Tapping returns to the session.                              | It is a progress indicator for a thing already started, and it ends when the session does.                         |
| App Intents      | "Start a ten minute session", "What is due?", "Open my map". Exposed to Siri, Shortcuts and the Action button.           | It removes three taps between deciding to practise and practising. That is the whole benefit.                      |
| Spotlight        | Every concept indexed with its title, summary and current state, deep-linking into its lessons.                          | It makes the app answer a question the learner already had, which is retrieval.                                    |
| Notifications    | Opt-in, off by default. At most one a day, only when items are actually due, at an hour the learner picks.               | Never loss-framed, never about a streak, never sent when nothing is due. Copy names the work, not the consequence. |
| Handoff          | Universal links to `/learn/<module>/<lesson>#<step>` in both directions, plus `NSUserActivity` so a lesson moves device. | Continuing on the larger screen is how the code-challenge steps get done.                                          |

## Sync and, until then, a file

Sync follows `docs/SYNC-PROTOCOL.md` exactly: events are immutable with UUIDv7 ids, merge is
a set union by id, the reducer sorts by `(at, deviceId, seq)`, the client keeps `pullCursor`
and `pushedSeq`, and unknown event types are kept and passed on untouched. `UnknownEvent`
already preserves the raw JSON for that reason.

Until the server exists, the two apps trade the same file. The web app's Settings screen
writes `{format: "understory-export", version: 1, exportedAt, events}` and `ExportFile` in
`UnderstoryKit` reads exactly that. On iOS:

- **Export** writes the file to a temporary URL and presents `ShareLink`, so it can go to
  Files, iCloud Drive, AirDrop or a message.
- **Import** uses `.fileImporter`, reads the file, upcasts every event, and merges by id.
  Importing the same file twice changes nothing, which the order-insensitivity tests already
  prove.
- The app registers a document type for `.understory.json` so the file opens from Files.

## Privacy

- No account, no analytics, no advertising identifier, no third-party SDK, no crash
  reporter that leaves the device.
- The only network calls are to the content origin for the manifest and lesson files, and
  later to the sync endpoint once an account exists.
- A privacy manifest (`PrivacyInfo.xcprivacy`) declares no tracking, no tracking domains,
  and the required-reason APIs actually used: `UserDefaults` (CA92.1) and file timestamps
  (C617.1).
- The App Store label will read **Data Not Collected**. If sync ships with accounts, it
  becomes "Contact Info: email, linked to you, used for app functionality" and nothing else.

## Testing

| Layer          | How                                                                                                                                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules          | Swift Testing. Every constant checked against the sentence in `docs/LEARNING-SCIENCE.md` it comes from.                                                                                                                                                                                                                    |
| Cross-platform | `contracts/fixtures/*.json` replayed through the Swift reducer, asserting the whole `expected` block. This is the contract.                                                                                                                                                                                                |
| Content        | The real files under `public/content/v1/` decoded, counted and spot-checked, plus a decode-and-encode round trip.                                                                                                                                                                                                          |
| Scheduling     | Pinned to values printed by `Scripts/print-reference-values.ts` against `src/core/scheduling/fsrs.ts`.                                                                                                                                                                                                                     |
| Runner         | The real `harness.v1.js`, with a staleness check against the web copy and an assertion that the harness's own limits match the Swift ones. Python, playgrounds and SQL run in real web views under `swift test`, and every scored playground and sql step of the built bundle is checked against the content gate's rules. |
| Views          | Snapshot tests per step type at three Dynamic Type sizes, light and dark, both identities.                                                                                                                                                                                                                                 |
| End to end     | One XCUITest that opens a lesson, answers one step of every type, and finishes it.                                                                                                                                                                                                                                         |
| Accessibility  | `performAccessibilityAudit()` on every screen in the XCUITest, which catches contrast, hit size, unlabelled elements and clipped Dynamic Type.                                                                                                                                                                             |

## Distribution

TestFlight first, internal then external. What the review notes must say, because
JavaScriptCore in an App Store app draws a question under guideline 2.5.2:

> The app includes a fixed JavaScript test harness, shipped inside the bundle and never
> updated over the air. Learners type JavaScript into an exercise editor and the app runs it
> to grade the exercise, the same way a calculator evaluates a typed expression. No
> executable code is downloaded. Lesson content is JSON and is data only. Nothing the app
> executes comes from anywhere but the learner's own keystrokes and the bundled harness.

## Risks

| #   | Risk                                                                                   | Mitigation                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A learner's endless loop freezes the app, and the only fix is private API.             | D9: learner code runs in `WKWebView` with its supported watchdog. `UnderstoryRunner` stays for content the app controls, and proves the timeout path in tests. |
| 2   | The two reducers drift apart after a rule change.                                      | The fixtures are the contract and CI runs `swift test` on every change to `contracts/` or `src/core`. The workflow is in `CONTRACT.md`.                        |
| 3   | The content bundle gains a field or a step type and older apps break.                  | Unknown step types decode to `.unsupported` and are skipped; unknown event types are kept and ignored. Both are tested against the real bundle.                |
| 4   | The identity choice lands after the app is built and every colour has to be revisited. | Tokens are generated from `src/styles/tokens.css` per identity. A view that names a literal colour fails a test.                                               |
| 5   | Liquid Glass reduces contrast under code and figures.                                  | Glass is confined to chrome, and the accessibility audit runs on every screen in both themes.                                                                  |
| 6   | Parsons and trace table are hostile on a small screen or with VoiceOver.               | Every drag has a tap equivalent and an accessibility action. The XCUITest answers a Parsons step using the actions only.                                       |
| 7   | Apple rejects the JavaScript engine under 2.5.2.                                       | Review notes above, no downloaded code, and the harness is in the bundle. If it is still refused, code challenges fall back to the web app through Handoff.    |
| 8   | The event log grows without bound on a heavy user.                                     | 4.5 MB a year, folded in milliseconds. If it bites, snapshot the fold every thousand events. Measured before optimised.                                        |

## Milestones

Sized in working days for one developer. Each milestone is done when `swift test` and the
app's test plan are green and the accessibility audit passes on every screen it added.

| #   | Milestone                     | Definition of done                                                                                                                                                                                          | Days |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| I0  | The package                   | `UnderstoryKit` and `UnderstoryRunner` build under Swift 6 strict concurrency. Content models decode the real bundle. The reducer reproduces all six fixtures. The runner runs the real harness. Done.      | 5    |
| I1  | Skeleton and design system    | Xcode project, five tabs, generated tokens for both identities, type styles, the spacing scale, the component set (button, card, hairline, figure, chip). Snapshot tests at three Dynamic Type sizes.       | 5    |
| I2  | Storage and content           | The append-only log file with atomic appends, the derived-state cache, the bundled starter snapshot, the manifest and lesson fetcher with hashed immutable caching, and offline behaviour proven in a test. | 6    |
| I3  | Lesson player, non-code steps | Prose, predict, multiple-choice, fill-blank, trace table, parsons, explain-back and recall. Events written for every answer. Accessibility actions on Parsons. One XCUITest walks a lesson.                 | 10   |
| I4  | Today, Learn, Map             | The three read screens, driven by `Insight`, with empty, loading and error states. The map's state-by-weight rendering, with the accent on gaps only.                                                       | 7    |
| I5  | Practise and sessions         | Session sizing, the session player, the closing screen, and the Live Activity. Phone sessions leave out steps that need typing, using `needsTyping`.                                                        | 7    |
| I6  | Code challenge                | The TextKit 2 editor, the symbol bar, the hint ladder, and the runner wired through `WKWebView` per D9, with the same `RunResult`. The reference-passes and starter-fails gate runs on device in CI.        | 8    |
| I7  | Platform surfaces             | Widget, App Intents, Spotlight indexing, notifications with the one-a-day cap, Handoff and universal links, export and import through Files and the share sheet.                                            | 7    |
| I8  | Signal, polish, TestFlight    | Signal list and day, Settings, the privacy manifest, the App Store label, review notes, the full accessibility audit on every screen, and a TestFlight build.                                               | 8    |
|     | **Total**                     |                                                                                                                                                                                                             | 63   |
