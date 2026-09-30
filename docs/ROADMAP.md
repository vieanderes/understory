# Roadmap

Where Understory stands, what is still open, and the order of the next work. Read it before
starting anything. Decisions and their reasons live in `docs/ARCHITECTURE.md`; this file
holds state and priorities only, so keep it short and current.

## 1. Where it stands

| Area           | State                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Course         | 370 lessons in 30 chapters and seven parts, each part with a checkpoint, a capstone and worked capstone solutions (`content/capstones/`). Every lesson meets `docs/WRITING-GUIDE.md`.                                                                                    |
| Learning paths | Seven paths in `content/tracks/`, each three or four stages. Each ends in a final exam at `/practise/exam/<path>` and a certificate at `/paths/<path>/certificate`.                                                                                                      |
| Plans          | `/plan` builds a plan from a goal, weekly time and starting point: phases drawn from the paths, a step for today, an exam per phase.                                                                                                                                     |
| Scout AI       | The study assistant on every page and lesson (Command or Ctrl and J), on the learner's own Claude: MCP, API key or local Claude Code. Absent from exams, checkpoints and test-outs.                                                                                      |
| Lectures       | Every lesson has `notes.yaml`. `/lectures` reads any scope, from one lesson to the course, and prints it to PDF. Each scope has a narrated playlist and an audiobook download.                                                                                           |
| Learning core  | Event log, reducer, mastery, FSRS scheduling, XP, weekly goal, ranks, calibration, practice sessions, placement at `/start`.                                                                                                                                             |
| Lesson player  | 13 step types in use. Code challenges in JavaScript, TypeScript, Python and React, optionally with a twin in a second language. Playgrounds for HTML, CSS, JavaScript and React. SQL on PGlite.                                                                          |
| Online tests   | AI-assisted coding simulator at `/practise/online-test`: intro, tour, IDE, Test Output, test-input.txt, submit, report with integrity and an AI assistant (API key, local Claude, MCP). 30 original tasks, 6 presets, training and custom tests (`docs/ONLINE-TEST.md`). |
| Labs           | Eight live: event loop, request journey, B-tree index, overselling, box model, flex and grid, isolation anomalies, cache layers.                                                                                                                                         |
| Phone          | Every screen from 390 px up. A phone code editor with a suggestion row, snippet gaps, trackpad keys and full screen (`docs/MOBILE-EDITING.md`).                                                                                                                          |
| Offline        | Service worker built on `postbuild`, a course download in Settings. JavaScript, TypeScript, Python and SQL run offline once fetched.                                                                                                                                     |
| Signal         | Pipeline, 41 verified feeds, a daily GitHub Action. Without an API key the briefs are extractive and read thin.                                                                                                                                                          |
| iOS            | `ios/UnderstoryKit`, a Swift package that decodes the content bundle and folds the event log. The app itself is in progress (`docs/ios/`).                                                                                                                               |
| Deployment     | Vercel-ready, plus a Dockerfile, Compose and Caddy for a VPS (`docs/DEPLOYMENT.md`). Not deployed yet.                                                                                                                                                                   |

## 2. Known gaps

- **Content.** About 40 lessons are gaining challenge twins. Python and React versions of
  older challenges are still to write. References marked `verified: false` need a person to
  check them. The woven chapters (17, 26, 27) and 24 Atlas have one more sweep to go, and
  Atlas's `platform-decision-matrix` lab is being rebuilt.
- **Lectures.** The Alpine image and Vercel builds print no PDFs; the button then opens the
  print page. OWASP links differ between security lessons 01 and 18.
- **Capstones.** A capstone is marked built on the learner's word.
- **Exams.** A path whose lessons change keeps the lesson ids recorded at the pass.
- **iOS.** The Swift reducer ignores `path_exam_attempted`. The app plays a challenge's main
  language only, has no SQL or React previews yet, and phone editing has not been checked on
  hardware.
- **Performance.** The lesson route ships about 284 KB of JavaScript against a 170 KB target;
  zod on the client is about 110 KB of it. Move client-side parsing to a lighter schema or to
  build time.
- **Tests.** `tests/e2e/code-challenge.spec.ts`, "the solution is fetched only on request",
  has failed once on mobile with "Response has been disposed": await the body inside the
  response handler. The editor test `typecheck.test.tsx` has an intermittent jsdom
  `getClientRects` error.
- **Readability.** When every lesson passes `pnpm content:readability`, move its rules into
  `pnpm validate:content` as warnings, then make them errors under `--strict`.

## 3. Priorities

1. **Correct before new.** Close the gaps in section 2 that a learner can see: references,
   OWASP links, the flaky tests.
2. **Finish the content.** Twins, the woven sweep, Atlas. One chapter per agent, author then
   reviewer, with `docs/REVIEW-BRIEF.md` applied before a lesson lands.
3. **Launch.** Deploy (`docs/DEPLOYMENT.md`), set `NEXT_PUBLIC_SITE_URL`, set
   `ANTHROPIC_API_KEY` as a repository secret for Signal, and meet the bundle budget.
4. **Product.** Incident desk and comprehension coverage (`docs/LEARNING-SCIENCE.md`, B6),
   then the iOS app.
5. **Polish.** Parsons control density and drag auto-scroll, reusable fill-blank tokens, a
   durable-storage notice, merge `InlineCode` and `InlineMd`, a `/design` component
   catalogue.

A new lab is worth building only where watching a mechanism move teaches what a playground,
a SQL step or a figure cannot.

## 4. How to run the work

- Definition of done: `pnpm check:fast`, plus the specs of any screen you changed. The full
  `pnpm check` and `pnpm test:e2e` are for releases and pipeline changes (`AGENTS.md`, law 12).
- CI on GitHub is only the fast gate (content rules, lint, types, unit tests; a few
  minutes). The solution gates, coverage, build and end-to-end suite run locally and in the
  "Full check" workflow, started by hand before a release.
- One chapter or one feature per agent, and at most four agents at a time.
- Commit after every finished piece of work. Never leave work only on disk.
- Parallel agents each use their own `NEXT_DIST_DIR` and `PW_PORT` for builds and e2e
  (`docs/LAB-BRIEF.md`, last section), and delete that directory afterwards.
- Every tool named in a lesson is checked against its own documentation, and every config
  and snippet shown is run, before the lesson lands.
- Node 24 through nvm (`nvm use`).
