# Interview kit

A practice kit for senior full-stack and AI engineering interviews: timed online tests,
live coding, and four-hour build-and-present sessions. It covers what an in-browser
sandbox cannot: React components, real servers, multi-file projects, real model calls and
Python.

It is its own package. Nothing here is part of the parent repository's checks.

## Set up

Node 22 or later and pnpm. From this folder:

```sh
pnpm install --ignore-workspace
```

`--ignore-workspace` keeps the install inside this folder. For the Python katas you also
need Python 3.12 and pytest; see `katas/python-katas/README.md`.

## Run a kata

Every kata is a folder in `katas/`:

- `BRIEF.md`: the prompt as an interviewer would give it, the contract, the constraints,
  and what they look for.
- `src/`: the starter. This is where you write. It compiles, and its tests fail.
- `tests/`: visible tests. Treat them like the example in an online assessment: passing them is the start.
- `solution/`: a reference. Read it after, not during.
- `fixtures/` (some katas): given code, such as a fake site or a fake model stream.

```sh
pnpm kata                       # list the katas
pnpm kata promise-pool          # run its tests against your code in src/
pnpm kata promise-pool --watch  # rerun on every save
pnpm kata promise-pool --solution
```

`--solution` runs the very same tests against `solution/`. The tests import from `../src`;
with `KATA_TARGET=solution`, a small resolver in `vitest.config.ts` swaps those imports for
the matching files in `solution/`. No copy of the tests can drift.

To start a kata again, `git checkout -- katas/<name>/src`, or keep your attempts on a branch.

`pnpm typecheck` checks everything, starters included. `pnpm test` runs every kata against
your code, so expect failures until you have done them all.

## Recommended order

Each step reuses an idea from the one before.

| #   | Kata                   | Format it rehearses                  | Time       |
| --- | ---------------------- | ------------------------------------ | ---------- |
| 1   | `python-katas`         | Online assessment, algorithmic       | 90 min     |
| 2   | `lru-cache-ttl`        | Live utility task, injected clock    | 45 min     |
| 3   | `promise-pool`         | Live utility task, concurrency       | 30-45 min  |
| 4   | `retry-backoff`        | Live utility task, cancellation      | 30-45 min  |
| 5   | `rate-limited-crawler` | Live two-phase task, uses 3 and 4    | 60 min     |
| 6   | `bookings-api`         | Back-end practical, Hono and zod     | 60-90 min  |
| 7   | `autocomplete`         | Front-end practical, ARIA combobox   | 60 min     |
| 8   | `data-table`           | Front-end practical, URL state       | 60-90 min  |
| 9   | `streaming-chat`       | AI product round, streams and cancel | 60-90 min  |
| 10  | `rag-mini`             | AI take-home, retrieval and evals    | 90-120 min |

Then the four-hour builds in `projects/`, one per session, with the templates.

## Rehearse under time

```sh
pnpm timer 90     # an online assessment or a live round
pnpm timer 240    # a build-and-present day
```

The timer counts down and rings at each checkpoint of the four-hour plan, scaled to the
length you give it:

| Share of time | 4 hours   | Do                                                                    |
| ------------- | --------- | --------------------------------------------------------------------- |
| 0 to 8%       | 0:00-0:20 | Read the brief, ask questions, write assumptions and three must-haves |
| 8 to 15%      | 0:20-0:35 | Skeleton: a thin path from UI through API to data, running            |
| 15 to 56%     | 0:35-2:15 | The core happy path end to end, committing often                      |
| 56 to 71%     | 2:15-2:50 | Error, empty and loading states, validation, guardrails, evals        |
| 71 to 81%     | 2:50-3:15 | Tests on the core logic                                               |
| 81 to 92%     | 3:15-3:40 | README with a diagram, trade-offs, next steps and how you used AI     |
| 92 to 100%    | 3:40-4:00 | Rehearse the demo, prepare a fallback, stop adding features           |

`pnpm timer 240 --fast` runs a whole session in ten seconds, to see every checkpoint.

## Practise like the real thing

- Say it aloud. Restate the problem, work one example by hand, name the brute force and
  its cost, agree the plan, then code. Test a normal case, a boundary and a nasty one.
- Ask first whether an assistant is allowed. If it is, plan aloud before you prompt, prompt
  in small pieces, run the tests, fix small things by hand, and be able to explain every
  line. `templates/question-bank.md` has the follow-ups.
- After each kata, compare with `solution/` and note one thing to do differently. The
  solutions' comments explain why, which is what an interviewer asks about.

## The rest of the kit

- `projects/`: four build briefs as a panel would hand them over, with rubrics and the
  questions you will be asked.
- `templates/`: a README template, a presentation outline with timings, a question bank
  with what a strong answer contains, and a self-review checklist.
- `pnpm eval:rag`: the RAG kata's golden-set eval. `--llm` uses Claude for answers when
  `ANTHROPIC_API_KEY` is set; nothing else in the kit needs a key or a network.
