# Content guide

> **Voice and length** come from `docs/WRITING-GUIDE.md`, which wins wherever this
> document disagrees. Check a lesson with `pnpm content:readability --only=<lesson dir>`.

How lessons are written so that content from many authors reads as one voice. The curriculum
map is in `CURRICULUM.md`. The evidence behind the lesson shape is in `LEARNING-SCIENCE.md`.

## Style guide

1. One idea per step. If a step needs "and", split it.
2. Concrete first. Show the code, the failure or the number before the rule that explains it.
3. Open with a question the learner cannot yet answer, and close by answering it.
4. Use exact, everyday words. Do not write "basically", "simply", "powerful" or "robust", or
   "Please" or "successfully".
5. Use British English, second person and active voice. Sentences of 8 to 14 words, never
   more than 20. Contractions are welcome.
6. Name things the way the spec names them. Define a term once, at first use, in one sentence,
   and never rename it.
7. Every claim about behaviour is runnable or cited. Give the primary source first: spec, RFC,
   paper or source code.
8. Code samples are 15 lines or fewer, complete and runnable, in a plain realistic setting
   that varies between lessons (`docs/AUTHOR-BRIEF.md`, "Examples"). No recurring product and
   no `foo`/`bar`. Every line in a sample has a purpose.
9. The opening says what the learner will be able to do and why it matters, in two short
   sentences. No characters, no trivia.
10. Feedback names the misconception, not only the answer, in a few words. For example:
    "Looks parallel, doesn't it? Each `await` waits for the last."
11. Hints form a ladder of three: where to look, what to notice, and the first step. The
    solution is a separate, explicit action.
12. Every lesson ends with 3 to 5 recall cards phrased as questions that need a produced
    answer, one explain-back prompt, and references. Deep Dive content goes below the fold and
    is never required for the scored steps.

### Editorial check

A lesson fails review if any of these is true.

- A step can be answered without reading the code.
- The prose could be deleted with no loss to the exercises.
- A term appears under two names.

Also no em-dashes, no emoji and no marketing language.

## Lesson anatomy

The contract is `src/core/content/schema.ts`. The rules that span files are in
`src/core/content/validate.ts`. Run `pnpm validate:content` after every edit. It reads all of
`content/` in under a second and names the file, the step and the fix.

- **One course.** Everything Understory teaches lives in `content/course/`: the web, the
  backend, Python, AI engineering, system design and interview preparation. There are no
  tracks. A new subject is a new module.
- **One directory per lesson**: `content/course/<module>/<lesson>/`.
- **Files**: `lesson.yaml` holds metadata and the ordered steps. Code-challenge assets are
  sibling files, `starter.ts`, `solution.ts` and `tests.ts`, so they are linted and
  type-checked (`.py` files for a Python challenge). The content compiler inlines them into
  the bundle.
- **Stable step ids.** Every step has an explicit `id`. An id is never an index and is never
  reused, so a content edit cannot orphan a learner's progress.
- **Markdown** is a documented CommonMark subset with no raw HTML, so Swift `AttributedString`
  can render it on iOS.
- **Lab steps need a fallback.** A `lab` step names a bespoke widget and must carry a
  `fallback` step for clients that lack the widget.
- **Hints** form a ladder of three. The solution is a separate action.
- **Recap**: `recap` holds three short lines on what the learner can now do. The summary
  screen shows them. `pnpm content:readability` reports a lesson without one.
- **Closing block**: 3 to 5 recall cards, one explain-back prompt, references with primary
  sources first.
- **Deep Dive** is optional content below the fold.
- **Difficulty seed.** Authors give each scored item a `d` from 1 to 5.
- **CI gate.** Every reference solution must pass its tests and every starter must fail them.
  "Hidden" tests are hidden in the interface only, since the bundle is public.

### Folders and files

```
content/course/course.yaml
content/course/outline.yaml
content/course/<NN>-<module-slug>/module.yaml
content/course/<NN>-<module-slug>/<NN>-<lesson-slug>/lesson.yaml
content/course/<NN>-<module-slug>/<NN>-<lesson-slug>/{starter,solution,tests}.ts
content/placement.yaml
content/ids.lock.json
content/harness.d.ts
```

- `NN` is a two-digit number that sets the order. The slug after it is the URL segment, so
  `03-javascript/02-scope-and-closures` is served at `/learn/javascript/scope-and-closures`.
  Two folders may not share a number.
- The module folder number equals `number` in `module.yaml`.
- Every object is strict. A misspelt key is an error, not a silent no-op.

### placement.yaml

Find your level (`docs/LEARNING-SCIENCE.md` B1). Schema: `placementFileSchema` in
`src/core/content/placement-schema.ts`. Every learner meets the same questions, so a change
here changes everyone's check.

- `areas`: the parts, in course order. Each has an `id`, a `title`, the `part` it mirrors
  (optional, for the test-out link), `quick` (the two modules the quick check asks) and its
  `modules` in course order. Every course module belongs to one area.
- A module has exactly two `core` questions and two `deep` ones. `core[0]` is asked in every
  mode, `core[1]` in the thorough check; `deep[0]` follows a right core answer, `deep[1]`
  confirms it. The four test four different lessons of the module.
- An item is a `predict-output`, `multiple-choice` or `bug-hunt` step (no `verify`) that
  reads in under 45 seconds, with exactly one correct choice. Its `concept` belongs to the
  module and picks the lessons a right answer marks known; `also` adds further concepts it
  truly tests, from modules of the same area. Ids read `<area>-<module>-<slug>`.
- Core questions are everyday scenarios with an "aha" in the feedback, not definitions.
  Mix questions with and without code. Run every snippet first, and say how in a comment
  above the item.
- `paths`: rules from the area to work on to a written path, `{ area, below, path }`. The
  first rule whose area matches and whose `below` is above the learner's level wins.

### course.yaml and module.yaml

| File          | Keys                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `course.yaml` | `title`, `summary`. There is one course, so it has no id.                                                                 |
| `module.yaml` | `id` (one lowercase word, such as `js`), `number`, `title`, `summary`, `why`, `youCanBuild`, `lab` (optional), `concepts` |

A concept has `id`, `title`, `summary` and an optional `confusableWith` list. Concept ids and
lesson ids start with the module id and a dot: `js.closures`. Practice interleaves the concepts
named in `confusableWith`, so list the ones learners mix up.

### lesson.yaml

| Key             | Rule                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`            | Dotted lowercase, `js.closures`. Unique across the course. Never reused.                                      |
| `title`         | A noun phrase.                                                                                                |
| `objective`     | Starts with a verb.                                                                                           |
| `level`         | `essential` or `advanced`.                                                                                    |
| `minutes`       | 3 to 60.                                                                                                      |
| `concepts`      | Concepts of this lesson's own module. Each should have at least one scored step.                              |
| `prerequisites` | Lesson ids. Advice, never a lock. Optional.                                                                   |
| `opening`       | `text`: what the learner will be able to do and why, in two short sentences.                                  |
| `steps`         | At least 4 steps, at least 3 step types, at least one `explain-back`.                                         |
| `recall`        | 3 to 5 cards: `id`, `concept`, `front`, `back`.                                                               |
| `references`    | At least one. `kind`, `title`, and optional `authors`, `year`, `venue`, `url`, `note`, `primary`, `verified`. |
| `recap`         | Three short markdown lines on what the learner can now do, shown on the summary screen.                       |
| `deepDive`      | Optional markdown below the fold.                                                                             |

Leave `verified: false` on a reference until a person has opened the source and checked every
field.

### Step fields

Every step has `type` and `id`. Every step except `prose` also has `concept` and `difficulty`
(1 to 5). A step id is lowercase words joined by hyphens and is unique inside its lesson.

| Type              | Fields                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prose`           | `body`, optional `figure` (`id`, `caption`). See "Figures" below.                                                                                                                                                                                                                                                                  |
| `predict-output`  | `code`, `language`, `question`, `choices` (2 to 5)                                                                                                                                                                                                                                                                                 |
| `multiple-choice` | `question`, `choices` (2 to 6), optional `code` and `language`                                                                                                                                                                                                                                                                     |
| `trace-table`     | `code`, `language`, `prompt`, `columns` (1 to 4), `rows` (`line`, `values`, optional `given`)                                                                                                                                                                                                                                      |
| `fill-blank`      | `prompt`, `template` with `{{1}}` blanks, `language`, `blanks` (`key`, `answer`, optional `accept`), `bank`                                                                                                                                                                                                                        |
| `parsons`         | `prompt`, `language`, `blocks` in the correct order (`id`, `code`, optional `indent` and `subgoal`), optional `distractors` (`id`, `code`, `feedback`), optional `checkIndent`                                                                                                                                                     |
| `bug-hunt`        | `code`, `language`, `prompt`, `lines` (1 to 3), `reasons`, optional `fix` and `verify` (see below)                                                                                                                                                                                                                                 |
| `ai-review`       | The `bug-hunt` fields plus `request` and `flawClass`                                                                                                                                                                                                                                                                               |
| `code-challenge`  | `prompt`, `language` (`js`, `ts`, `tsx` or `python`), `hints` (exactly 3), `starter`, `solution`, `tests` file names (optional for `ts`); for `ts`, `typecheck` and `expectStarterTypeError` (see "Type checking"); `editable` (see "Editable region"); in an assessment also `hidden`, `performance`, `timeLimitMs`, `bruteForce` |
| `explain-back`    | `prompt`, `rubric` (exactly 3 points), `modelAnswer`, optional `audience` and `kind` (see below)                                                                                                                                                                                                                                   |
| `lab`             | `lab`, `intro`, optional `preset` and `checkpoint`, and a `fallback` step                                                                                                                                                                                                                                                          |
| `incident`        | `incident` and a `fallback` step                                                                                                                                                                                                                                                                                                   |
| `playground`      | `prompt`, `html` or `jsx`, optional `css`, `js`, `editable`, `showTree`, `checks` (1 to 8, each with optional `actions`), `solution`, `hints` (1 to 3). See "Playgrounds" below.                                                                                                                                                   |
| `sql`             | `prompt`, optional `setup`, `starter`, `solution`, `checks` (`ordered`, `query`), `showSchema`, `hints` (1 to 3). See "SQL steps" below.                                                                                                                                                                                           |

A choice has `text`, `feedback` and, on the right one only, `correct: true`. Choice `text` is a
single line of inline markdown, because it sits inside a button. A `fallback` is any step
except `lab` and `incident`.

`flawClass` is one of `logic`, `race`, `security`, `hallucinated-api`, `edge-case`,
`performance`, `data-exposure` (the code returns or logs more than it should) and
`regression` (the change fixes one case and breaks one that worked).

A `bug-hunt` or `ai-review` can carry a `verify` follow-up: how you would prove the fix.

```yaml
verify:
  question: Which test would have caught this?
  choices:
    - text: A quantity read from a form field
      correct: true
      feedback: Form fields hold strings, so this shows the join.
    - text: A quantity of zero
      feedback: Zero adds nothing, so the join never shows.
```

The question is 20 words or fewer. Two to four choices, exactly one `correct: true`, and
feedback on each, held to the same lengths as any choice. The player asks it once a reason
is picked, and one Check covers all three. The hunt is three quarters of the score and the
verify answer one quarter; full credit needs both.

An `explain-back` can say who the learner explains to and what they are asked for.
`audience` is one of `teammate` (the default), `newcomer`, `non-technical`, `reviewer`,
`interviewer` and `incident`. `kind` is `explain` (the default: why it happens), `decide`
(defend a choice and its trade-off) or `risk` (what could go wrong and how you would check).
The player shows the frame above the prompt, for example "Defend the choice to a reviewer".
`pnpm content:readability` reports a chapter with six or more explain-backs where more than
two thirds share one audience and kind (`explain-back-variety`).

### Figures

A prose step can carry one figure, for an idea that is spatial or happens in order: a
pipeline, a loop, a pile of stack frames, a tree. It sits under the body with its caption.

```yaml
- type: prose
  id: what-rag-is
  body: >-
    ...
  figure:
    id: rag-pipeline
    caption: The model only sees the 3 chunks that search kept.
```

- `id` is one of the figures registered in `src/core/content/figures.ts`. The validator
  rejects any other.
- `caption` is one sentence on what to notice, not a description of the drawing. The
  figure already says what each step shows; the caption says why it matters. Quote a
  caption that contains `: `.
- Use a figure where a picture carries the idea better than a sentence. One per step, and
  rarely more than one per lesson. It never replaces an exercise.
- Put it on the step whose body introduces the idea, so the words and the drawing arrive
  together.

There are two kinds. **Still figures** (`request-hops-cold`, `request-hops-warm`,
`event-loop-queues`) are a lab engine's output drawn once. **Stepped figures** tell the
idea in 4 to 8 steps with Back, Next and Play: each step is a sentence, and a numbered
key names the parts of the drawing.

| Figure                | Shows                                                       | Where                                                                       |
| --------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `rag-pipeline`        | question, embed, search, top k, prompt with sources, answer | `20-ai-engineering/08-rag`, `what-rag-is`                                   |
| `agent-loop`          | model, tool call, run tools, repeat, stop reason, step cap  | `20-ai-engineering/09-agents`, `what-an-agent-is`                           |
| `tool-use-round-trip` | request with tools, tool_use, run, tool_result, answer      | `20-ai-engineering/04-tool-use`, `round-trip`                               |
| `embedding-space`     | texts as points, neighbourhoods, nearest neighbours         | `20-ai-engineering/06-embeddings-and-vector-search`, `what-an-embedding-is` |
| `call-stack`          | frames pushed on a call and popped on a return              | `00-basics/09-errors-and-stack-traces`, `what-the-call-stack-is`            |
| `dom-tree`            | HTML read tag by tag into the DOM tree                      | `01-html/03-the-dom`, `file-to-tree`                                        |
| `event-loop`          | call stack, microtask queue, task queue, console            | `03-javascript/16-the-event-loop`, `stack-and-queues`                       |
| `box-model`           | content, padding, border, margin, to scale                  | `02-css/03-the-box-model`, `four-areas`                                     |
| `request-response`    | a request out and a response back, parts named              | `03-javascript/17-requests-and-responses`, `request-and-response`           |

A new figure is code, not content: draw it with the kit in
`src/features/lesson-player/figures/kit/`, follow "Figures" in `docs/DESIGN.md`, add its id
to `FIGURE_IDS`, register it in `LessonFigure.tsx`, and add it to the figure tests. The
event loop figure takes its steps from the lab engine, so it cannot disagree with the lab;
do the same wherever a lab already models the idea.

### Playgrounds

A `playground` step is a real page to edit: the learner types HTML, CSS or JavaScript and
the page redraws beside the editor (below it on a phone) a quarter of a second later. Use
one whenever the lesson is about what a page looks like or how the browser builds it. The
HTML and CSS chapters should never ask a learner to imagine a page they could see.

```yaml
- type: playground
  id: build-first-heading
  concept: html.elements # needed with checks
  difficulty: 1 # needed with checks
  prompt: >-
    Change the heading to your favourite food. Watch the page.
  html: |
    <h1>Pancakes</h1>
  css: | # optional: the learner gets an HTML and a CSS tab
    h1 { color: teal; }
  js: | # optional: runs after the HTML. Without it, no script runs at all
    document.querySelector("h1").textContent = "Hello";
  editable: [html] # default: every field the step has
  showTree: true # optional: the live DOM tree next to the page
  checks: # optional: with checks the step is scored
    - label: The page has one `h1` # plain text, backticks allowed
      selector: h1
      count: 1 # exact count; without it, at least one match
      text: Pancakes # the first match contains it, trimmed, any case
      attribute: { name: alt } # exists; add value: for an exact match
      style: { property: color, value: 'rgb(0, 128, 128)' } # computed, on the first match
  solution: # needed with checks: the finished fields
    html: |
      <h1>Waffles</h1>
  hints: ['The heading text sits between the tags.']
```

- **Without checks** it is a sandbox to explore: no score, and the player offers Continue. Use
  it for "try it and watch".
- **With checks** it is a produce step, scored by the share of checks that pass, with the
  usual second try. The checklist ticks live as the learner types. After a failed attempt
  the solution is shown, with its own preview.
- `html` may be a body fragment (the playground wraps it in a document with `lang="en"`) or a
  whole document with its own `head`.
- A style check compares the **computed** value, the way a browser reports it: colours as
  `rgb(…)`, lengths in `px`. The gate runs the checks in jsdom, which has no layout, so do not
  check a layout result such as the used width of a block; check the declared property.
- The validator requires `concept`, `difficulty` and `solution` with checks, lets `editable`
  name only fields the step has, and keeps the solution to editable fields. The **playground
  gate** then loads the solution and the starter into jsdom with the same document and probe
  the preview uses: the solution must pass every check with no script error, and the starter
  must fail at least one.
- Readability: the prompt is one task of at most 40 words, and each check label is at most
  10 words, like a choice.
- The finished HTML ships inside the lesson, not in the solutions file: it is short and
  must work offline.

#### React playgrounds

With `jsx` in place of `html`, the playground holds a React component file (JSX or TSX)
and the page renders it with a real React 19. Use one whenever seeing a component render,
or clicking it, is the lesson: a first component, state that updates, a list that
reorders. Use a `tsx` code challenge instead when the task is about behaviour tests can
describe better than a checklist.

```yaml
- type: playground
  id: fix-rep-counter
  concept: react.state
  difficulty: 2
  prompt: >-
    Click the button: it stays at 0. Give it state with `useState`.
  jsx: | # the default export is rendered into <div id="root">
    import { useState } from "react";

    export default function RepCounter() {
      let reps = 0;
      return <button onClick={() => { reps = reps + 1; }}>{reps} reps</button>;
    }
  css: | # optional, as in any playground; html is optional too
    button { font-size: 20px; }
  showTree: true # the tree shows what React made, #root included
  checks:
    - label: The button starts at 0 reps # no actions: looks at a fresh render
      selector: button
      text: 0 reps
    - label: Three clicks show 3 reps
      actions: [{ click: button }, { click: button }, { click: button }]
      selector: button
      text: 3 reps
    - label: Typing adds a task
      actions: [{ type: Buy milk, into: input }, { click: 'form button' }]
      selector: li
      count: 1
  solution:
    jsx: | # the whole finished file
      ...
```

- **Imports.** Only `react`, `react-dom` and `react-dom/client`. Anything else is an error
  the learner sees. The file is transpiled the way a `tsx` challenge is (sucrase: types off,
  JSX to calls), so TSX types are fine and nothing is type-checked.
- **Actions** run in order on a **fresh render** before the check looks: `click` clicks the
  first match, `type` types into the first matching input or textarea one character at a
  time, with a render after each step. So checks never depend on each other or on what the
  learner clicked in the preview. A check without actions looks at a fresh render too.
  Actions are only allowed in React playgrounds.
- There is no "not" check. To say something is absent, use `count: 0`, for example
  `selector: li:first-child input:checked` with `count: 0`.
- The preview shows React's development warnings under the page ("React warns: Each child
  in a list should have a unique key prop"), and errors with the learner's line. The gate
  fails a solution React warns about, so a starter can warn on purpose and a solution
  cannot.
- A React playground cannot have `js`: the component is the script.
- The gate renders the starter and the solution in jsdom with the same React file and the
  same frame script as the preview, then runs the actions there.

### SQL steps

A `sql` step is a real Postgres database to query. The learner writes SQL, presses Run, and
sees every statement's rows in a table, or Postgres's own error, word for word. Use one
whenever a lesson is about what a query returns or what the database refuses. The
databases chapter should never ask a learner to imagine rows they could see.

```yaml
- type: sql
  id: find-unshipped-orders
  concept: db.select-pipeline # needed with checks
  difficulty: 1 # needed with checks
  prompt: >-
    Show every order that hasn't shipped yet.
  setup: | # tables and seed rows, run on a fresh database before every run
    CREATE TABLE orders (id integer PRIMARY KEY, customer text, shipped boolean);
    INSERT INTO orders VALUES (1, 'Ana', true), (2, 'Ben', false);
  starter: | # optional: what the editor holds at the start
    SELECT * FROM orders;
  solution: | # needed with checks
    SELECT * FROM orders WHERE shipped = false;
  checks: # optional: with checks the step is scored
    ordered: false # default false; true when the task says ORDER BY
    query: SELECT * FROM orders ORDER BY id # optional, see below
  showSchema: true # optional: the tables and their columns beside the editor
  hints: ['A `WHERE` clause keeps only the rows that match.']
```

- **How it is judged.** The page runs the solution on the same fresh database and compares
  the two results: the same columns, by name and in order, and the same rows. Rows are
  compared as a multiset, so order counts only with `ordered: true`, and values as the
  text Postgres prints (`t` for true, `12.50` for a `numeric(8,2)`). No one writes the
  expected rows by hand, so they can never drift from the solution.
- **What is compared.** The last statement that returned rows. For a task that changes
  rows (`INSERT`, `UPDATE`, `DELETE`, `ALTER TABLE`), set `checks.query`: it runs after the
  learner's SQL and after the solution, and its results are compared. End that query with
  `ORDER BY` or leave `ordered` off.
- **Without checks** it is a database to explore: no score, and the player offers Continue.
  Use it for "run this and read what comes back".
- **Every run starts over.** The setup runs on a fresh database each time, so a learner who
  drops a table loses nothing. Statements run one by one, like psql, and a run stops at the
  first error, which is shown with its line, its `DETAIL` and its `HINT`.
- A wrong first try earns the usual second one. After a failed attempt the feedback lists
  what differs (a missing column, a row too many) and the solution is shown with its rows.
- Write SQL keywords in capitals, as the rest of the databases chapter does, and keep the
  setup to the few rows the task needs: the learner reads every one.
- Timezone is UTC and dates are ISO in every run, so a `timestamptz` prints the same for
  every learner. There is no network, no extension beyond `plpgsql`, and a run stops after
  5 seconds.
- The validator requires `concept`, `difficulty` and `solution` with checks. The **sql
  gate** in `pnpm validate:content` runs the setup and the solution in Node on the same
  PGlite build the browser uses: the setup must run, the solution must run without an
  error and return rows (or its `query` must), and the starter must not already give the
  solution's result.
- Readability: the prompt is one task of at most 40 words.
- The solution ships inside the lesson, not in the solutions file: it is short, and the page
  needs it offline to judge a run.
- Phone sessions keep sql steps, like playgrounds: a query is a line or two, the symbol bar
  puts `*`, brackets and quotes first, and a wide result scrolls inside its own table.

### What the validator checks beyond the schema

Errors stop the build.

- Module, lesson and concept ids are unique. Step ids, card ids and parsons block ids
  are unique inside their lesson or step. A fallback counts as a step of the lesson.
- Every `concept` named by a lesson, step or card is defined in a `module.yaml`. `confusableWith`
  and `prerequisites` point at things that exist.
- Every choice list has exactly one `correct: true`.
- `lines` and trace-table `line` values fall inside the code. Each trace row has one value per
  column, and at least one row is not `given`.
- Every `{{n}}` in a template has a blank, every blank is used, and every answer is in the
  `bank`.
- Code-challenge files exist, sit next to `lesson.yaml` and are not shared between two
  challenges. A Python challenge uses `.py` files and a JavaScript or TypeScript one does
  not.
- `typecheck: true` sits only on a `ts` step with `.ts` files, and `expectStarterTypeError`
  only on a step that is type-checked.
- A Python challenge's `packages` names exactly the packages its files import, and only a
  Python challenge has `packages`.
- `editable` names starter lines that exist and leaves at least one line locked, and the
  solution matches the starter on every locked line.
- A twin is in another language than its step, and never on an assessment task
  (`twin-shape`). Its files follow every rule above, read against the twin's language.
- Markdown has no HTML tags and no `#` heading. The subset is paragraphs, emphasis, inline
  code, links, lists, fenced code and `##` headings.
- The opening has at most two sentences.

Warnings do not stop the build. CI on `main` runs `pnpm validate:content --strict`, where they
do.

- A banned word: basically, simply, just, powerful, robust, easy, obviously, please,
  successfully.
- An exclamation mark or an em-dash outside code.
- A sentence of more than 28 words. Aim for 22.
- Code of more than 15 lines, in a code field or in a fence.
- A concept in `concepts` with no scored step.

### Code-challenge files

`starter.ts`, `solution.ts` and `tests.ts` are TypeScript modules. `pnpm typecheck:content`
checks the solution and the tests; the solution gate checks the starter (see "Type
checking"), so a starter may be unfinished but must compile.

- The starter and the solution `export` the functions under test, with the same signatures.
- `tests.ts` imports them from `'./solution'` and uses the harness globals `test` and
  `expect`, declared in `content/harness.d.ts`. At run time the runner binds that import to the
  code being checked, which is the learner's code in the browser.
- The matchers are `toBe`, `toEqual`, `toBeTruthy`, `toBeFalsy`, `toThrow`, `toContain`,
  `toBeCloseTo` and `toHaveLength`, each also under `.not`.
- A lesson with two challenges names its files per step, for example `total.starter.ts`, and
  sets `starter`, `solution` and `tests` in each step.
- Run every code sample with Node before you write its answer into a choice.

### Editable region

`editable: "3-5"` locks every starter line outside lines 3 to 5. The learner edits only
those lines; the scaffold around them stays as written, drawn on a quiet band. On a phone
this is the difference between scrolling past setup and typing only what the task is about
(docs/MOBILE-EDITING.md, section 8.4).

- Use it when the starter has scaffold the learner must not touch: a signature, the data,
  a `return` the tests rely on. Leave it out when the whole file is the exercise.
- The range counts starter lines from 1, both ends included, and may grow as the learner
  types. A single line is `"4"`.
- The solution must equal the starter outside the range. The validator checks it
  (`editable-solution`).
- A draft whose locked lines no longer match (saved before the region existed) opens with
  no lock. Reset brings the lock back.

```yaml
- type: code-challenge
  id: write-add-handler
  language: js
  editable: '12-13'
```

### Type checking

A `ts` challenge is type-checked. While the learner types, the editor underlines each type
error in red and shows the compiler's own message on hover, when the caret is in it, and in
a list under the editor. A run passes only when the tests pass and the code has no type
errors: "Type errors" appears as a failed check in front of the tests, with the messages.
The checker is the real TypeScript compiler with the options of `tsconfig.content.json`
(strict, `noUncheckedIndexedAccess`, the ES2023 library, no DOM), the harness globals and
`console` and timers, which the sandbox provides. The tests are context: their own errors
are never shown to the learner.

- `typecheck: false` turns it off, for the rare step whose code must not be checked, for
  example one that shows a type hole on purpose. `.js` files in a `ts` step are never
  checked, and `js`, `tsx` and `python` steps are not checked either.
- The gate type-checks the solution and the starter with the same program. The solution
  must be clean. So must the starter, so that a learner meets the exercise and not a red
  underline.
- `expectStarterTypeError: true` is for a step whose task is to fix a type error: the
  starter must then have one, and it may pass the tests, because the type error is what it
  gets wrong. Leave the error in plain sight, without `@ts-expect-error`.

```yaml
- type: code-challenge
  id: fix-total-type
  language: ts
  expectStarterTypeError: true
```

A starter can still hide an error behind `// @ts-expect-error` and ask for the comment to
go once the line is fixed: the checker then reports the unused directive until it does.

### React challenges

`language: tsx` makes a challenge about a React component. The learner writes a component,
and the tests render it and use it the way a person would, with Testing Library. It runs in
the same sandbox as every other challenge (docs/SANDBOX.md, "React challenges").

- Name the files `.tsx` and set them in the step: `starter: starter.tsx`,
  `solution: solution.tsx`, `tests: tests.tsx`. The validator refuses a `.ts` file in a tsx
  challenge and a `.tsx` file in any other.
- `pnpm typecheck:content` checks `.tsx` files with `tsconfig.content-tsx.json`: the DOM
  library, JSX and React's types.
- The starter and the solution `export` the component. JSX needs no `import React`; import
  hooks from `'react'`.
- `tests.tsx` imports the component from `'./solution'`, `render` and `screen` from
  `'@testing-library/react'`, and `userEvent` from `'@testing-library/user-event'`. Each
  test starts on an empty page.
- Query the way a person finds things: `getByRole` with a `name`, `getByLabelText`,
  `getByText`. `queryBy...` returns null, `findBy...` waits. Prefer roles: a challenge that
  passes by role is accessible by construction.
- `userEvent.setup()` gives `click`, `dblClick`, `hover`, `type` (with `{Enter}`,
  `{ArrowDown}`, `{Escape}`, `{Backspace}`, `{Tab}`), `keyboard`, `clear`, `tab` and
  `selectOptions`. Await every call.
- Extra matchers: `toBeInTheDocument`, `toHaveTextContent`, `toHaveAttribute`,
  `toHaveValue`, `toBeDisabled`, `toBeEnabled`, `toBeChecked`, `toHaveFocus`, `toBeVisible`,
  `toHaveClass`, `toBeEmptyDOMElement`, `toContainElement`, declared in
  `content/react-harness.d.ts`.
- There is no layout and no style sheet. Visibility comes from `hidden` and inline styles
  only; sizes and positions are zero. Test behaviour and ARIA, not pixels.
- `tests/fixtures/react-challenge/` is a complete example: an accessible autocomplete.

A minimal example:

```tsx
// starter.tsx
export function Counter() {
  return <button>Clicked 0 times</button>;
}

// solution.tsx
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}

// tests.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './solution';

test('starts at zero', () => {
  render(<Counter />);
  expect(screen.getByRole('button', { name: 'Clicked 0 times' })).toBeInTheDocument();
});

test('counts clicks', async () => {
  const user = userEvent.setup();
  render(<Counter />);
  await user.click(screen.getByRole('button'));
  await user.click(screen.getByRole('button'));
  expect(screen.getByRole('button')).toHaveTextContent('Clicked 2 times');
});
```

### Assessments

For the online-test simulator's tasks and presets, which are a separate kind of content with
their own gates, see `docs/ONLINE-TEST.md`, section 5.

An assessment rehearses a timed online coding assessment (docs/INTERVIEWS.md). It is a
lesson with `assessment: true`, and its `minutes` are the time limit (up to 180). It holds
prose briefs and one to three `code-challenge` tasks, nothing else. The learner starts a
clock, runs the examples as often as they like, and submits; at zero the code is submitted
as it stands. The score is the share of hidden tests passed, one verdict per test: OK, wrong
answer, timed out or runtime error.

Each task sets, besides the usual files:

- `tests`: the examples Run checks. One to three small tests. They do not score.
- `hidden`: six to twelve correctness tests on the corner cases. Each runs alone.
- `performance`: two to four large-input tests. Each runs alone within `timeLimitMs`
  (default 2000), so a correct but slow solution times out.
- `bruteForce`: a correct, slow solution. The gate requires it to pass every hidden test
  and to time out on at least one performance test, which proves the large inputs measure
  the complexity. The reference solution must pass every performance test in half the time
  limit, to leave room for a slower browser.

Build large inputs inside the test, with a loop or a small seeded generator, never with
`Math.random`. Name the files per task, for example `pairs.hidden.ts`. The validator
refuses hidden or performance tests outside an assessment, and an assessment without them.
Assessments skip the rules that shape an ordinary lesson (explain-back, step variety, the
ten-minute warning). Hints and the reference solution appear only after the attempt.

### Python challenges

`language: python` runs the challenge in Pyodide: CPython 3.12, the version assessment platforms
commonly use, with the standard library, plus numpy, pandas and pydantic when the step names them
("Packages and async" below). The default file names are TypeScript, so a Python step names
its files:

```yaml
- id: write-two-sum
  type: code-challenge
  concept: python.dicts
  difficulty: 2
  language: python
  starter: starter.py
  solution: solution.py
  tests: tests.py
  prompt: Return the indexes of the two numbers that add up to `target`, or `None`.
  hints: [...]
```

`starter.py` and `solution.py` define the same function:

```python
def two_sum(values, target):
    # Your code here
    return None
```

`tests.py` registers each test with the `@test` decorator. The code and the tests share one
namespace, so the tests may call `two_sum` directly; `from solution import two_sum` also
works and reads better.

```python
from solution import two_sum


@test("finds the pair")
def _():
    expect(two_sum([2, 7, 11, 15], 9)).to_equal([0, 1])


@test("returns None when no pair adds up")
def _():
    assert two_sum([1, 2], 10) is None


with describe("edges"):

    @test("an empty list")
    def _():
        expect(two_sum([], 1)).to_be_none()
```

- A plain `assert` is fine and often reads best. A failing `assert got == wanted` reports
  `Expected wanted, received got`, so put the learner's value on the left. An `assert` with
  your own message shows that message.
- `expect(value)` has `to_equal` (the usual one, `==`), `to_be` (the same type and value for
  numbers, strings and booleans, the same object otherwise), `to_be_none`, `to_be_truthy`,
  `to_be_falsy`, `to_contain`, `to_have_length`, `to_match` (a regular expression),
  `to_be_close_to`, `to_be_greater_than`, `to_be_less_than` (each also `_or_equal`),
  `to_be_instance_of` and `to_raise`. Negate with `.not_`, since `not` is a keyword:
  `expect(result).not_.to_contain(0)`.
- `to_raise` takes a function: `expect(lambda: parse("x")).to_raise(ValueError, match="digit")`.
- `printed()` returns the lines printed so far, for a challenge about output:
  `expect(printed()).to_equal(["Hello, Ada"])`.
- `test("name", fn)` works too, for a one-line test: `test("zero", lambda: expect(f(0)).to_equal(1))`.
- Name each test `_` or give it a real name; the string is what the learner sees.
- A test may be `async def`, and then it awaits the learner's coroutine. See below.
- Python files are not type-checked. The solution gate runs them: the solution must pass,
  the starter must fail, and there must be two tests or more.
- Hidden and performance tests for an assessment are `.py` files too. CPython in WebAssembly
  runs about half as fast as native Python, so size `timeLimitMs` on what the gate measures.

#### Packages and async

A step may import `numpy`, `pandas` or `pydantic`, and nothing else beyond the standard
library. Name them in the step, exactly those its files import:

```yaml
- id: write-top-k
  type: code-challenge
  language: python
  starter: search.starter.py
  solution: search.solution.py
  tests: search.tests.py
  packages: [numpy]
```

- The validator checks the list against the `import` lines of the starter, solution and
  tests: an import it does not name is an error, and so is a name nothing imports.
- The first run that needs a package downloads it (numpy 2.9 MB, pydantic 1.8 MB, pandas
  with numpy 9 MB) and imports it before the run's time starts. The step shows "Loading
  numpy…" meanwhile. Later runs are instant, and offline too.
- Write the import in the starter, so the learner sees what they may use.
- The iOS app does not run packages yet: such a step fails there.

Async code is tested with async tests. The test awaits the learner's coroutine:

```python
from solution import classify_all


@test("keeps the order of the reviews")
async def _():
    assert await classify_all(["b", "a"], fake_classify, 2) == ["B", "A"]
```

- `asyncio.sleep`, `gather`, `Semaphore`, `wait_for` and `timeout` work. Fake the model
  call with a coroutine that sleeps for a few milliseconds and records what it saw.
- Never call `asyncio.run`, in the starter, the solution or the tests. The browser's
  event loop is already running, so it raises a message that says to await instead.
- Threads cannot start in the browser. Teach threads with other step types.

### Twins

A code challenge can carry the same exercise in a second language, so a learner practises
it in TypeScript or in Python and switches with one control above the editor. The prompt,
hints, id, concept and scoring are shared: solving either language solves the step.

```yaml
- id: write-chunk
  type: code-challenge
  language: ts
  starter: chunk.starter.ts
  solution: chunk.solution.ts
  tests: chunk.tests.ts
  twin:
    language: python
    starter: chunk.starter.py
    solution: chunk.solution.py
    tests: chunk.tests.py
  prompt: Write `chunk(text, size)`. ...
  hints: [...]
```

- The twin's `language` is `js`, `ts` or `python`, and not the step's own.
- Write the prompt and hints so they fit both languages: name the function once, in a form
  both use (`chunk(text, size)`), and keep the hints about the idea, not the syntax.
- The twin names its own files. `packages` and `editable` are its own too, read against its
  starter. A TypeScript twin is type-checked like any `ts` step; name its starter so it ends
  in `starter.ts`, which `tsconfig.content.json` leaves to the solution gate.
- The solution gate runs the twin like the main files: its solution passes its tests, its
  starter fails them, and it registers two tests or more. Its issues name the twin, as
  `write-chunk, Python twin`.
- The build puts the twin's solution in the solutions file under `<id>:twin`, fetched only
  when the learner asks, and prints both solutions in the lecture, each labelled.
- The player remembers the learner's choice (`understory:challenge-language` in
  localStorage) and opens every step with a twin in that language. A step without that
  language opens in its own. Each language keeps its own draft.
- An assessment task has no twin: its hidden tests are one language.

### The ids lock

`content/ids.lock.json` lists every id that has shipped: lessons, steps, cards and concepts.
Learner progress is stored under these ids.

- New ids: run `pnpm validate:content --write-lock` and commit the file.
- Removing or renaming an id is an error until the old id is listed under `retired` by hand.
- A retired id can never come back, because old progress would attach to new material.

### What the build emits

`pnpm build:content` writes the bundle to `public/content/v1/` and the JSON Schema contracts to
`contracts/schemas/`. The compiled shapes are defined in `src/core/content/compiled.ts`.

- `manifest.json` holds the course map and `contentRev`.
- `lessons/<id>.<hash>.json` is the compiled lesson. Every markdown field becomes
  `{ md, html }`, and every code field gains a highlighted sibling such as `codeHtml`. Colours
  in the HTML are `--shiki-*` CSS variables. The starter and the tests are inlined as
  `starterCode` and `testsCode`.
- `solutions/<id>.<hash>.json` holds the reference solutions, fetched only on request.
- The same input gives the same bytes, so a hashed file can be cached for ever.

### Step types

prose, predict-output, trace-table, multiple-choice, fill-blank (token bank), parsons (with
distractors and subgoal labels), bug-hunt, code-challenge (starter, tests, reference solution,
hint ladder), ai-review (one seeded flaw in plausible AI-written code), explain-back (rubric
self-grade), playground (edit a live page, optional checks), sql (query a seeded Postgres
database, optional checks), lab, incident, recall, references.

Phone sessions use only the types that need no typing of code. Desktop adds the unplugged
editor. A playground and a sql step stay in phone sessions: their edits are small, and
seeing the page or the rows is the point.

### Step order inside a concept

predict or trace, then arrange, then fix, then write, then explain. This order follows the
evidence that tracing skill precedes writing skill (Lopez et al. 2008; Xie et al. 2019).

An `ai-review` step appears in every lesson from Module 3 onward. The flaw classes rotate
through logic, race, security, a hallucinated API, an unhandled edge, performance, data
exposure and a regression.

## Primary readings for the 12 most important lessons

**[V]** means confirmed by web search during planning. **[M]** means cited from memory and to
be checked before the lesson ships.

| Lesson                                | Reading                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.10 The event loop                   | WHATWG, _HTML Living Standard_ section 8.1.7 "Event loops" [M]; J. Archibald, "Tasks, microtasks, queues and schedules", 2015 [M]                                                                |
| 9.1 HTTP in depth                     | Fielding, Nottingham and Reschke (eds), RFC 9110 _HTTP Semantics_, IETF 2022; RFC 9111 _HTTP Caching_, 2022 [M]                                                                                  |
| 9.4 Sessions, cookies and tokens      | Barth, RFC 6265 _HTTP State Management Mechanism_, 2011; Hardt, RFC 6749 _OAuth 2.0_, 2012, with RFC 7636 PKCE [M]                                                                               |
| 10.4 Indexes                          | Comer, "The Ubiquitous B-Tree", ACM Computing Surveys 11(2), 1979; Bayer and McCreight, "Organization and maintenance of large ordered indexes", Acta Informatica 1, 1972 [M]                    |
| 10.7 Isolation levels                 | Berenson, Bernstein, Gray, Melton, O'Neil and O'Neil, "A Critique of ANSI SQL Isolation Levels", SIGMOD 1995; Ports and Grittner, "Serializable Snapshot Isolation in PostgreSQL", VLDB 2012 [M] |
| 14.7 Locks                            | Kleppmann, "How to do distributed locking", 2016 (essay); Lamport, "Time, Clocks, and the Ordering of Events in a Distributed System", CACM 21(7), 1978 [M]                                      |
| 9.8 and 14.8 Webhooks and idempotency | Helland, "Idempotence Is Not a Medical Condition", ACM Queue 10(4) / CACM 55(5), 2012 [V]; IETF HTTPAPI draft, "The Idempotency-Key HTTP Header Field" [M]                                       |
| 14.12 Failure handling at scale       | Dean and Barroso, "The Tail at Scale", CACM 56(2), 2013; Brooker, "Exponential Backoff and Jitter", AWS Architecture Blog, 2015 [M]                                                              |
| 12.1 Threat modelling                 | Saltzer and Schroeder, "The Protection of Information in Computer Systems", Proc. IEEE 63(9), 1975; OWASP Top 10, current edition [M]                                                            |
| 15.1 and 15.3 Boundaries              | Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules", CACM 15(12), 1972; Cockburn, "Hexagonal Architecture", 2005 [M]                                                        |
| 18.1 How LLMs work                    | Vaswani et al., "Attention Is All You Need", NeurIPS 2017 [M]. For 18.6 and 18.7: Lewis et al., RAG, NeurIPS 2020; Yao et al., ReAct, ICLR 2023 [M]                                              |
| 0.7 and 18.4 Working with AI          | Shen and Tamkin 2026, arXiv 2601.20245 [V]; Perry et al., CCS 2023 [V]                                                                                                                           |

### Runners-up

All of these are [M].

- Saltzer, Reed and Clark, "End-to-End Arguments in System Design", ACM TOCS 2(4), 1984.
- Kleppmann et al., "Local-first software", Onward! 2019.
- Gilbert and Lynch, SIGACT News 33(2), 2002.
- Wiggins, _The Twelve-Factor App_, 2011.
- W3C, WCAG 2.2, 2023.
