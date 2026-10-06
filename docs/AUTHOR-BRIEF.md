# Author brief

> **Voice and length** come from `docs/WRITING-GUIDE.md`, which wins wherever this
> document disagrees. Check a lesson with `pnpm content:readability --only=<lesson dir>`.

How to write an Understory lesson. Read this, then `docs/CONTENT-GUIDE.md` (style rules and
lesson anatomy), then `docs/WRITING-GUIDE.md`, then the reference lesson end to end:
`content/course/00-basics/01-your-first-line-of-code/`. It is the bar for tone,
length and density.

## The fixed frame

- Your lessons are listed in `content/course/outline.yaml`. The `id`, `dir`, `title`,
  `objective`, `level` and `concepts` there are fixed. Create the directory
  `content/course/<module dir>/<lesson dir>/` and write `lesson.yaml` in it.
- Concept ids come from the module's `module.yaml`. Use only those listed for your lesson.
  Never edit `module.yaml`, `outline.yaml`, `ids.lock.json` or another author's lesson.
- The schema is `src/core/content/schema.ts`. Every object is strict: an unknown key is an
  error. The `.describe()` texts say what each field wants.

## The reader

One reader is a newcomer. The other is an engineer with years of practice who builds real
systems with AI assistance and wants to explain every layer from first principles. Write so
the first is never lost and the second is never bored: concrete first, exact terms, the
real mechanism, no padding. If a step could be answered without reading the code, or the
prose could be deleted with no loss, it fails review.

## Examples

Understory is a general platform. There is no recurring product, brand or cast, and no
reference to a real person, company, client or private project.

- Pick the plainest realistic setting that makes the concept obvious, and vary settings
  across lessons: a shopping cart, a room booking, a chat app, a to-do list, a blog, a bank
  transfer, a weather dashboard, a library catalogue, a rate limiter, a leaderboard, an
  image upload.
- The concept picks the example, never the other way round. Two people buying the last
  item in stock is a fine race condition: it is a universal case, not a product.
- One sentence of setup at most. If removing the setting makes the step clearer, remove it.
- No `foo` or `bar`. Names are ordinary and brief: `cart`, `booking`, `user`.
- `pnpm validate:content` rejects the names of the withdrawn single-product setting.

## The shape of a lesson

7 to 10 steps, 10 minutes or less, in the order the skills build (Lopez et al. 2008; Xie et al. 2019).
The `opening` says what the learner will be able to do and why they would want to, in two
short sentences. The first scored step is an easy win.

1. **Predict or trace** first (`predict-output`, `trace-table`), before any explanation.
   A wrong prediction is the point: it opens the gap the prose then closes.
2. **Prose**, short. One idea per step. At most three prose steps, never two in a row.
3. **Arrange and complete** (`parsons` with given `subgoal` labels and one or two
   distractors, `fill-blank` with distractor tokens in the bank).
4. **Fix and review** (`bug-hunt`; from module 3 onward at least one `ai-review`: plausible
   assistant-written code, exactly one seeded flaw, and a note in the prompt on why a quick
   test did not catch it. Rotate `flawClass` through all eight, `data-exposure` and
   `regression` among them). From chapter 11 onward, give one `bug-hunt` or `ai-review` per
   lesson a `verify` follow-up where it fits: how would you prove the fix, or what could it
   regress. One right choice, real wrong ones (a test that cannot see the fault).
5. **Write** (`code-challenge`, language `js` or `ts`) wherever the topic can be exercised as
   a pure function. HTML, CSS, SQL, shell and config topics have no runnable challenge yet:
   use an extra `parsons` or `fill-blank` on the real syntax instead.
6. **Explain** (`explain-back`), last. Ask for a cause, not a definition. Vary who it is
   for and what it asks across a chapter with `audience` (a newcomer, a reviewer, someone
   non-technical, an interviewer, the incident channel; a teammate when absent) and `kind`
   (`explain` why it happens, `decide` to defend a choice and its trade-off, `risk` for what
   could go wrong and how you would check). No single frame takes more than two thirds of a
   chapter's explain-backs.

Also:

- Every listed concept gets at least one scored step. Use at least four step types.
- `difficulty` rises through the lesson: 1 to 2 early, 3 to 4 late, 5 only when it is hard
  for an experienced engineer.
- Every choice has `feedback`. Right: at most 15 words, why it is right. Wrong: at most 25
  words, what they probably thought and the one reason it does not hold. Vary the wording;
  never repeat one template through a lesson. Never only "Wrong" or "Correct".
- Exactly one choice is `correct: true`. Make the distractors the real mistakes people make.
- `hints` are a ladder of exactly three: where to look, what to notice, the first step.
- 4 recall cards. Each `front` is a question that needs a produced answer. Each `back` is
  one or two sentences.
- `deepDive` (optional, encouraged for advanced readers): what the spec says, the edge
  case, the history, the performance cost. Below the fold, never needed for the steps.
- If `outline.yaml` gives your lesson a `lab`, include exactly one `lab` step with that id,
  an `intro` that says what to try and what to watch for, a `checkpoint` question, and a
  `fallback` step (any portable type) for clients without the lab.

## Lecture notes

When you write or touch a lesson's `notes.yaml`, follow `docs/LECTURE-BRIEF.md`. Give it a
`verify` list, "Before you ship": two to eight one-sentence checks a senior engineer runs
before shipping code that uses the idea, each under a lens (`breaks`, `scales`, `confuses`,
`leaks`, `tests`). Pick the lenses the idea needs, and make each check specific enough to
act on.

## Code

- 15 lines or fewer per sample, complete, runnable, every line with a purpose.
- **Run it.** Before you write an answer, execute the snippet with `node` (or the right
  tool) and copy the real output. A lesson that teaches a wrong output is worse than none.
- Code challenges: `starter.ts` exports the function with a body that compiles and fails the
  tests; `solution.ts` exports the reference; `tests.ts` imports from `'./solution'`, uses
  the global `test` and `expect`, and has 4 to 7 tests including the edge cases named in
  the prompt. A lesson with two challenges names its files in the step (`starter`,
  `solution`, `tests` keys).

## Language

Follow `docs/WRITING-GUIDE.md`: conversational and warm, one idea per screen, sentences of 8
to 14 words and never more than 20, one question per step, choices of at most 10 words, no
author names or years in steps. British English. Contractions are welcome. Banned: basically,
simply, obviously, powerful, robust, Please, successfully, the em-dash character, marketing
language. Markdown subset only: paragraphs, emphasis, inline code, links, lists, fenced
code. No raw HTML, no headings.

## References

2 to 5 per lesson, primary sources first: the spec, the RFC, the paper, the source code,
then the best docs page or essay. Mark the one or two that matter most `primary: true`.
Only cite what you are sure exists, with correct authors, year and venue. Set
`verified: false` on every reference: a person checks them before they ship. Do not invent
URLs. If you are unsure of a URL, leave `url` out.

## Check your work

```sh
export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH
pnpm validate:content --strict --only=<your lesson dir>
pnpm content:readability --only=<your lesson dir>
pnpm exec tsc --noEmit -p tsconfig.content.json
```

All three must be clean for your lessons. `--only` filters the report to your files, because
other authors are mid-edit elsewhere. The validator also runs every reference solution
against its tests and requires every starter to fail. Do not run `--write-lock`, do not run
git commands that change anything, do not change dependencies or any file outside your
lesson directories.

## Report

When done, report in under 150 words: the lessons written, steps per lesson, which step
types, any concept you could not cover and why, and any fact you were unsure about.

## Budget

Work within the scope and budget the lead session gives you. If the task grows beyond
it, stop and report what is left instead of carrying on.
