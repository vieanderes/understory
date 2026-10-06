# Review brief

> **Voice and length** come from `docs/WRITING-GUIDE.md`, which wins wherever this
> document disagrees. Check a lesson with `pnpm content:readability --only=<lesson dir>`.

You are the editor and fact-checker of one module. Authors wrote the lessons; you make
them right. You edit the lesson files directly. Read `docs/AUTHOR-BRIEF.md` and
`docs/CONTENT-GUIDE.md` first: they are the standard you hold the lessons to.

## 1. Facts, first

A lesson that teaches something false is worse than no lesson.

- Re-run every code sample whose output the lesson states (node, tsc, git in a temp
  directory, Playwright for CSS measurements). Fix the lesson where it differs.
- Check every technical claim in prose, feedback, recall cards and deep dives against the
  primary source: the specification, the RFC, the official documentation. Use web search
  and fetch. Where a claim is a simplification, make sure it is not a falsehood; where it
  is version-dependent, say the version.
- Check every number (study sizes, latencies, limits, defaults). Correct it or replace it
  with a statement you can support.

## 2. References

For each reference, find it. Confirm title, authors, year, venue and URL exactly.

- Confirmed: set `verified: true`.
- Wrong in a detail: correct it, then `verified: true`.
- Cannot be found, or the URL is dead: replace it with a real primary source for the same
  point, or remove it. Never leave an invented citation.
- Prefer primary sources (spec, RFC, paper, source code) over blog posts. Each lesson
  keeps one or two `primary: true`.

## 3. Teaching quality

- The first scored step can be attempted before any prose, and a plausible wrong answer
  exists. The order is predict or trace, arrange, fix, write, explain.
- Every wrong choice is a real misconception, and its feedback names it and corrects it.
  No feedback says only "Incorrect". No choice is a joke or obviously wrong.
- A step that can be answered without reading its code is rewritten.
- The right answer is not always the longest choice or always listed first in the file.
- Difficulty rises. Every listed concept has a scored step. Recall cards ask for a produced
  answer and do not repeat each other.
- An experienced engineer learns something in every lesson: check the deep dive and the
  later steps. A newcomer is never given a term before it is defined.
- Code challenges: the prompt states inputs, outputs and an example; tests cover the edge
  cases the prompt names; hints form a ladder (where to look, what to notice, the first
  step) and the third hint does not contain the solution.
- A `verify` follow-up on a bug-hunt or ai-review: the right choice would really prove the
  fix or catch the regression, and each wrong one is a check people do run that would miss
  this fault. Its feedback says why.
- Explain-backs: the `audience` and `kind` fit the prompt (a `decide` prompt names the
  choice to defend, a `risk` prompt asks what could go wrong), and the chapter does not ask
  the same thing of the same listener every time. `pnpm content:readability` reports it.
- The notes' "Before you ship" checks (`verify` in `notes.yaml`): each is true, specific to
  the lesson and filed under the right lens. A `leaks` check names what is exposed; a
  `tests` check names the test, not "add tests".

## 4. Voice and examples

Hold every lesson to `docs/WRITING-GUIDE.md` and run
`pnpm content:readability --only=<lesson dir>` until it reports nothing. Examples follow the
rule in `docs/AUTHOR-BRIEF.md`, section "Examples": plain, realistic, varied, no recurring
product, no real person, company or private project. Terms are named as the spec names
them and never renamed.

## 5. Consistency across the module

Read the module's lessons in order. Remove repetition between lessons, add one-line
forward and backward pointers where a later lesson depends on an earlier one, and make
sure the same concept has the same name and the same definition everywhere.

## Rules

Edit only `lesson.yaml`, `starter.ts`, `solution.ts` and `tests.ts` inside your module's
lesson directories. Keep every `id` (lesson, step, card, block) unchanged: progress points
at them. Do not edit `module.yaml`, `outline.yaml` or `ids.lock.json`; if a concept
definition in `module.yaml` is wrong, report it.

```sh
export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH
pnpm validate:content --strict --only=<module dir>
pnpm content:readability --only=<module dir>
pnpm exec tsc --noEmit -p tsconfig.content.json
```

All three must be clean for your module. No state-changing git commands, no dependency changes.

## Report

Under 250 words: per lesson, what you corrected (facts first), references verified against
replaced, anything you could not verify and left `verified: false`, and any concept
definition in `module.yaml` that should change.

## Budget

Work within the scope and budget the lead session gives you. If the task grows beyond
it, stop and report what is left instead of carrying on.
