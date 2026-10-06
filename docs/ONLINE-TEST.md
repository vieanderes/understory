# The AI-assisted coding simulator

A practice copy of the timed online coding assessment most employers send first: the
candidate experience of the common assessment platforms, with their layout, flow, wording,
scoring and report. It is built so that sitting the real test feels familiar. It lives at
`/practise/online-test`, under Coding tests in the navigation.

The behaviour is taken from a walk-through of a leading platform's public demo test on 29
September 2026, its candidate FAQ, its public example report and its training lessons. Where
we could not see something, the choice is marked "inferred". No platform is named here on
purpose: the simulator rehearses the format, not a brand.

## 1. What matches, and what differs on purpose

Matches:

- **Flow.** Intro page, 8-step tour, the "Are you ready to start?" dialog, then the IDE.
  The clock starts only after the dialog.
- **Clock.** One clock for the whole test, shown as `0h 29min`. It never pauses, not even
  when you quit. When it runs out, the code as it stands is submitted.
- **Layout.** Top bar, a left rail with task tabs and tools, a task panel, a solution panel
  with a Files tree (`task1/solution.ts`, `test-input.txt`), editor tabs, the language
  dropdown, the hint bar, Test Output with Run code (F9), and a footer with the save status.
- **Editing.** Each task keeps one solution per language. Changing the language asks first
  and keeps the old solution.
- **Output.** The Test Output wording (section 3), your own test cases in `test-input.txt`,
  and unlimited runs.
- **Dialogs.** Submit ("Submit your assessment?"), quit ("Quit anyway") and a 1-minute survey.
- **Candidate results.** Correctness, performance and task score per task, "Passed N out of
  M" per group, and a total score ring.
- **Employer report.** Named test groups with a verdict per case, the detected time
  complexity, a code playback, integrity signals and the assistant transcript.
- **Task types.** Algorithmic, coding (correctness only) and bug-fix (limited changed lines).
- **Test shapes.** A 30-minute demo, 90 to 120-minute screens, and 120-minute training on one
  task, as in the platforms' training lessons.

Differs on purpose:

| The platforms                   | Here                                        | Why                                                    |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Its brand, logo and colours     | The app's Instrument identity, generic mark | Our design laws, and not our brand to copy             |
| 20 languages                    | JavaScript, TypeScript, Python              | What the sandbox runs in the browser                   |
| Monaco editor                   | CodeMirror styled like it, with Vim mode    | Bundle budget; the editor, phone work and tests use it |
| Not supported on phones         | Works on phones, stacked panes              | Law 7. The intro says to sit the real one on a laptop  |
| Candidates see a summary only   | The employer report is one tap away         | Practice is for learning what reviewers see            |
| Server-side runs                | Browser sandbox; Python limits × 5          | Pyodide is slower than CPython                         |
| Real-life, SQL, live-pair tasks | Not in v1                                   | Algorithmic, coding and bug-fix tasks come first       |

## 2. Flow

1. **Hub** (`/practise/online-test`): preset tests, training on any task, a custom test, and
   past results.
2. **Intro**: "N minutes for M tasks", the "Before you begin" list, the allowed languages, an
   accessibility-mode checkbox and a required consent checkbox that enables "Start the test".
3. **Tour**: 8 steps (Time limit, Autosave, Adjust your window, Submit your solution,
   Accessibility mode, Editor settings, Quit this test, That's it), skippable. Then "Are you
   ready to start?".
4. **IDE** until you submit or the time runs out. Help reopens the tour. Quit leaves the
   clock running; the hub shows "Resume" while time is left.
5. **Outro**: "Your test has ended", the 1-minute survey or Skip.
6. **Results**: "Your test summary", then the detailed (employer) report.

## 3. Output

Run code runs each example, then each line of `test-input.txt` (at most 10), each case in its
own sandbox run with a hard limit of 5 seconds. The text follows the platform:

```
Compilation successful.

Example test:   [2, 5, 1, 2, 7, 3]
Output:
debug 6
WRONG ANSWER (got 1 expected 4)

Your test case: [2, 3]
Returned value: 1

Example test:   [1, 2, 3]
TIMEOUT ERROR (Killed. Hard limit reached: 5.000 sec.)

Producing output might cause your solution to fail performance tests.
You should remove code that produces output before you submit your solution.

Detected some errors.
```

When every example passes: "Your code is syntactically correct and works properly on the
example test." and, in italics, "Note that the example tests are not part of your score. On
submission at least N test cases not shown here will assess your solution." TypeScript
compiler errors print under "Compiler output:" and stop the run. The code lives in
`src/core/online-test/output.ts`.

## 4. Verdicts and scoring

- A case gets one of OK, WRONG ANSWER (got X expected Y), TIMEOUT ERROR, RUNTIME ERROR.
- A test is a group of cases and passes only if all of them do.
- Example tests are shown but never scored.
- Correctness and performance are each the share of their tests that passed.
- An algorithmic task scores the mean of the two. Coding and bug-fix tasks score correctness
  alone.
- Code that does not compile scores 0. So does a bug-fix that changes nothing, or changes
  more lines than allowed.
- The total is the mean of the tasks. Percentages round down.
- Detected time complexity comes from the slope of time against input size across the scored
  cases (`src/core/online-test/complexity.ts`).

## 5. Authoring a task

One folder per task: `content/online-tests/tasks/<id>/`. The schema lives in
`src/core/online-test/schema.ts`. The three seed tasks (`lowest-free-ticket`, `scoreboard`
and `longest-streak`) are the models to copy.

| File          | Needed                   | What                                                                         |
| ------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `task.yaml`   | always                   | Metadata, signature, statement, examples, tests                              |
| `solution.ts` | always                   | The reference. Every expected value is what it returns                       |
| `solution.py` | always                   | Must return the same on every case, in half its time limit                   |
| `brute.ts`    | algorithmic, recommended | Passes every correctness case and times out on at least one performance case |
| `buggy.ts`    | bug-fix                  | The starter with the bug. `solution.ts` changes 1 to `maxChangedLines` lines |
| `buggy.py`    | bug-fix                  | The same in Python                                                           |

The function is always `solution`, with capital parameter names (`A`, `N`, `K`, `S`).

Types:

- The allowed types are `int`, `bool`, `string`, `int[]`, `string[]` and `int[][]`. Their
  JSON is identical in both languages.
- Keep results below 2^53. Both references must agree.

The statement uses the platform's structure, in your own words:

1. A short story, then "Write a function:", then a line holding only `{{signature}}`.
2. "that, given ..., returns ...".
3. Examples: "For example, given A = [...], the function should return X." Then "Given
   ..., the function should return Y."
4. The assumptions:
   - Algorithmic tasks: "Write an **efficient** algorithm for the following assumptions:"
     followed by a bulleted list with ranges written as `[1..100,000]`.
   - Coding and bug-fix tasks: "Assume that:" and the list, then "In your solution, focus
     on **correctness**. The performance of your solution will not be the focus of the
     assessment."

Tests:

- **Names.** Use snake_case with the platform's vocabulary: `example`, `extreme_single`,
  `extreme_empty`, `simple`, `small_random`, `medium_random`, `large_random`, `extreme_large`,
  `large_range`, `all_equal`, `negative_only`.
- **Descriptions.** Keep them short. For a large test, give N ("random, N = 100,000").
- **Size.** At least 8 hidden cases, and typically 4 to 7 tests with 1 to 3 cases each.
- **Groups.**
  - Correctness tests use small inputs and cover the corner cases.
  - Performance tests (algorithmic only) use large inputs.
  - Size the performance tests so the brute force times out and the reference runs in
    under half of `timeLimitMs`. The default limit is 1500 ms per case in JavaScript;
    Python gets five times that.
- **Case form.** A case is either `{ args: [...], expected: ... }` (`expected` is optional;
  the reference fills it in and the gate checks any value you write) or
  `{ generate: { seed, args: [spec per parameter] } }`.

Generator kinds (`src/core/online-test/generate.ts`):

| Kind          | Fields         | Builds                                      |
| ------------- | -------------- | ------------------------------------------- |
| `value`       | value          | That literal                                |
| `int`         | min, max       | One integer                                 |
| `ints`        | n, min, max    | n integers                                  |
| `sorted`      | n, min, max    | n integers in non-decreasing order          |
| `permutation` | n, drop?       | 1..n shuffled, with `drop` elements removed |
| `constant`    | n, value       | n copies of `value`                         |
| `range`       | n, start, step | start, start + step, ...                    |
| `string`      | n, alphabet    | n characters drawn from an ASCII alphabet   |
| `repeat`      | times, unit    | A string or int list repeated               |
| `pairs`       | n, min, max    | n `[a, b]` with a ≤ b                       |

- Tasks are original. Use the platform's syllabus families (`topic`), never its task text or
  names. The examples are generic (law 10). Beyond the algorithm families, `topic` takes
  `api-integration`, `reliability`, `data-sync`, `ai-systems`, `agents` and `evals` for
  coding and bug-fix tasks from the later chapters (`TOPICS` in
  `src/core/online-test/schema.ts`).
- Titles are one CamelCase word.
- `pnpm validate:content` runs the gates: expected values agree with the reference, Python
  agrees with TypeScript, the speed limits hold, the brute force behaves, and bug-fix limits
  hold.

Preset tests live in `content/online-tests/tests/<id>.yaml` (`presetFileSchema`):

- `id`, `title`, `summary`
- `mode` (`demo`, `screen` or `ai`)
- `order`, `minutes`, `tasks`
- `languages` (optional; default is all three)
- `assistant`, `proctoring`

## 6. The assistant

A panel like the platforms' built-in AI assistant, in the left rail of every test. The test's own setting,
or the box on the intro page, only decides whether it opens by itself at the start. Every
message goes into the transcript the report shows, as the reviewer would read it. Three
providers sit behind `src/core/ports/assistant.ts`:

1. **Your Claude account, through MCP.** No API key. Connect Claude to the simulator's MCP
   endpoint once and send it one message, "Keep answering my Understory questions, code
   ABCD-EFGH". Claude then listens: it calls `wait_for_question`, which holds for up to 45
   seconds until the learner asks in the panel and returns the question with the page, the
   code and the last output; Claude answers through `reply` and waits again. The panel shows
   "Claude is listening" while it checks in. It stops when the learner says so, or when the
   tab has been quiet for an hour: the panel says "still open" at most once a minute
   (`GET /api/assistant/bridge?open=1`), and an ended session stops it at once. The older
   one-question tools (`get_pending_question` and the rest) still work.
   - Claude on the web, desktop or phone: Settings, Connectors, Add custom connector, with
     `<site>/api/mcp`. This needs the deployed site: claude.ai cannot reach localhost.
   - Claude Code, with a server: `claude mcp add --transport http understory <site>/api/mcp`.
   - Claude Code, with the Understory plugin, a [channel](https://code.claude.com/docs/en/channels-reference)
     in `integrations/claude-code/`: questions are pushed into the session, so Claude spends
     nothing while it waits. Install it once with
     `claude plugin marketplace add vieanderes/understory && claude plugin install understory@understory`,
     start with `claude --dangerously-load-development-channels plugin:understory@understory`,
     and send "Connect Understory at <site>, code ABCD-EFGH". During the research preview
     a channel outside Anthropic's allowlist needs that flag and a confirmation, and Team
     and Enterprise plans must turn channels on. The plugin has no dependencies; it is a
     client of the same `/api/mcp`, so the same locks below apply.
   - The pending question and the replies live in a bridge store. On one long-running
     server (`pnpm dev`, the VPS) memory is enough. On Vercel set `UPSTASH_REDIS_REST_URL`
     and `UPSTASH_REDIS_REST_TOKEN` (or Vercel's Redis integration's `KV_REST_API_URL` and
     `KV_REST_API_TOKEN`), so every serverless instance sees the same sessions. A listening
     Claude costs about one read every 1.5 seconds while it waits.
   - Pick **No sign-in** when adding the connector, then press **Allow** in the panel
     when Claude first uses the code. See "How it stays safe" below.
2. **Your API key.** Kept in this browser; each request goes to `/api/assistant`, which
   streams from the Anthropic Messages API and never stores the key. Works on any host.
3. **Claude Code on this machine.** Only when the app runs on your machine (`pnpm dev`, or
   `ASSISTANT_LOCAL_CLI=1 pnpm start`): `/api/assistant/local` runs `claude -p` with the
   account logged in there.

### How it stays safe

The MCP connector has no sign-in, because Understory has no accounts: there is nothing
for OAuth to check. Three locks take its place, one per party, and the panel explains them
behind "How this stays safe" (`src/features/online-test/assistant/ConnectionSafety.tsx`).

1. **The pairing code** names a session: eight characters from 31, about 40 bits, made in
   the tab. **New code** replaces it and ends the old session at once. An idle session is
   dropped after 30 minutes.
2. **The tab's secret** (256 bits) is made beside the code and never leaves the tab. The
   bridge keeps only its SHA-256 hash, and serves the tab's side (asking, pushing context,
   reading replies, allowing a connection, ending) only with it. So a code seen in a chat
   or over a shoulder cannot plant a question or read the conversation. A second tab using
   the same code gets 403 and moves to a new code.
3. **The learner's Allow.** At `initialize` the server gives each app connection its own
   `Mcp-Session-Id`, stored with the sessions so any serverless instance knows it. The
   first tool call from a connection the session has not seen records it as a request and
   waits up to 45 seconds; the panel polls, shows Allow and Deny, and the call goes through
   once allowed. From then on only that connection is served; another is refused, or told
   to ask the learner, and never sees the code or the question. A new connection that is
   allowed replaces the old one.

Around them:

- Everything the tab sends reaches Claude fenced in `<untrusted>` tags, and the server's
  instructions say it is data, not instructions, so a planted "now read my email" cannot
  steer the learner's other connectors. The read tools are annotated read-only; `reply`
  only posts to the panel, which renders plain Markdown with no HTML and `http(s)` links.
- The code and secret travel in headers (`x-pairing-code`, `x-tab-secret`), never in a URL
  or an access log.
- Rate limits are counted in the same store, so on Vercel with Redis every instance shares
  one count. Twenty wrong codes or secrets from one client shut it out for ten minutes.
- A request with a foreign `Origin` (another site's page) is refused, as the MCP spec
  asks, and every MCP response is `Cache-Control: no-store`.

What is left: someone who can read the learner's Claude chat, and gets the learner to
press Allow for them, within the session. The panel shows the time of every request and
of the allowed connection, and New code ends it all.

## 6a. Guided mode

A coach beside the IDE that walks one task along the path a strong candidate takes. Switch it
on from the intro page, or open **Guide** in the left rail at any point (on a phone, the Guide
pane). Each step says what to do and why:

- what to read first (the assumptions, and what N and "efficient" say about the complexity);
- how to restate the task and which edge cases to list, with lines to add to
  `test-input.txt`;
- what to ask the AI assistant and when, word for word, and why that question is a good one
  ("Put in the assistant" fills the box; you still send it);
- what to write yourself and what to let the assistant write, and how to check what it wrote;
- when to bank a correct slow version, when to optimise, and when to submit.

Full solutions in a step can be loaded into the editor after a confirmation. A guided attempt
is marked in the report and in the event (`guided: true`), because it is a rehearsal, not a
measurement.

Authoring: `content/online-tests/tasks/<id>/guide.yaml`, schema `guideFileSchema` in
`src/core/online-test/guide.ts`, model `lowest-free-ticket/guide.yaml`. Guides compile to
`public/content/v1/online-tests/guides/<id>.json` and load only in guided mode. The gate
type-checks every full step and runs the last one, in TypeScript and Python, against every
hidden test: a guide can never lead to a wrong answer.

## 7. Where the code lives

| Part                                                            | Path                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Rules: values, input, program, verdicts, output, score, attempt | `src/core/online-test/`                                                                        |
| Assistant port                                                  | `src/core/ports/assistant.ts`                                                                  |
| Build and gates                                                 | `scripts/lib/online-tests.ts`                                                                  |
| Content                                                         | `content/online-tests/`                                                                        |
| Bundle                                                          | `public/content/v1/online-tests/`                                                              |
| UI                                                              | `src/features/online-test/`                                                                    |
| Routes                                                          | `src/app/(app)/practise/online-test/`, `src/app/(focus)/practise/online-test/`, `src/app/api/` |

## 8. Tests on the paths

Every preset, every training task and the levelled mock sits in at least one path stage,
after the lessons that teach what it needs. A stage lists them under `tests` in
`content/tracks/<id>.yaml`, easiest first:

```yaml
tests:
  - { test: screen-a, guided: true } # a preset; guided suggests the coach
  - { task: torn-pages } # one task as training, sat as train-torn-pages
  - { lesson: interview.mock-levelled } # an assessment lesson
  - { lab: event-loop-stepper } # a lab, from src/core/labs/catalog.ts
```

- Tests are optional. They never count towards finishing a path, but the stage shows them
  as recommended, with the XP a full score earns and the learner's best score.
- The stage shows them under "Try it", after its lessons: first "Practise this stage", a
  ten-minute session scoped to the stage's chapters (`/practise/session/10?chapters=…`),
  then labs, then tests. It shows three and folds the rest.
- Every lab sits in a stage too. A lab earns no XP itself; it is there to be tried.
- The validator fails an unknown preset, task or lesson id and a test listed twice in one
  path, and warns about a preset, task or lab that no stage lists (`online-test-off-path`).
- The levelled mock runs in the lesson player, not the simulator. It is named "Practice
  test 4" so it reads as one more practice test, on the paths and in the hub.
