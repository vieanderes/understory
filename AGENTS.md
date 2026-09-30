# Rules for coding agents

Start with `docs/ROADMAP.md`: current state, the priority order and how to run the work.

## This is not the Next.js you know

This repo runs Next.js 16. APIs, conventions and file names differ from older versions
(`proxy.ts` replaced `middleware.ts`, Turbopack is the default bundler, Cache Components
exist). Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js
code, and heed deprecation notices.

## Where things live

| You want to change                                            | Go to                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A path (the front door: goal, stages, lessons)                | `content/tracks/<id>.yaml`, `src/lib/content/paths.ts`, `src/features/paths/`     |
| A lesson, a recall card, a reference                          | `content/course/<module>/<lesson>/` and `docs/CONTENT-GUIDE.md`                   |
| A lesson's lecture notes, a capstone's worked solution        | `notes.yaml` beside the lesson, `content/capstones/`, and `docs/LECTURE-BRIEF.md` |
| What a lesson file may contain                                | `src/core/content/schema.ts`, then the validator and the docs                     |
| A learning rule (mastery, XP, weekly goal, ranks, scheduling) | `src/core/`, test first, and `docs/LEARNING-SCIENCE.md`                           |
| The code editor, and writing code on a phone                  | `src/features/editor/` and `docs/MOBILE-EDITING.md`                               |
| Storage, the code sandbox, news fetching                      | `src/adapters/` behind a port in `src/core/ports/`                                |
| A screen                                                      | `src/features/<feature>/`, routes in `src/app/`                                   |
| A colour, size, radius, typeface                              | `src/styles/tokens.css` only, and `docs/DESIGN.md`                                |
| Why something is the way it is                                | `docs/ARCHITECTURE.md` decision table                                             |

## Laws

1. `src/core` is framework-free. No React, Next, Node or browser globals. ESLint and
   `tsconfig.core.json` enforce it. Need the outside world? Define a port.
2. Domain rules are written test first. `src/core` keeps 95% coverage.
3. Events record facts. XP, ranks, mastery and the weekly run are derived by the reducer
   and never stored, so a sync merge cannot double-count.
4. Design tokens only. No arbitrary Tailwind values, no literal colours, no `dark:`, no
   gradients, no glow, no emoji as icons. One icon library: lucide, 2 px stroke.
   `tests/unit/scripts/design-laws.test.ts` fails otherwise.
5. Four text sizes, three weights, the 8 pt grid (`p-1` is 8 px, `p-0.5` is 4 px).
   The accent marks the primary action and a knowledge gap, nothing else.
6. Interface copy: British English, fewer exact words, no "Please", no "successfully", no
   exclamation marks, no em-dashes, no marketing language. Lesson text is warmer: see rule 11.
7. Desktop and phone are equal. Every screen is checked at 390, 768, 1024 and 1440 in
   light and dark, and passes axe (WCAG 2.2 AA) in the e2e suite.
8. No `setState` inside an effect to mirror external state. Use `useSyncExternalStore`.
9. Comments explain why, not what.
10. Examples are generic. No recurring fictional product, and no real people, their projects
    or their clients. See `docs/AUTHOR-BRIEF.md`, "Examples"; the validator enforces it.
11. Lesson text follows `docs/WRITING-GUIDE.md`: conversational, one idea per screen,
    short sentences, short choices and feedback. `pnpm content:readability` measures it.
12. Size the check to the change. Every change: `pnpm check:fast` (about a minute; it runs
    solutions only for the lessons you changed). A screen change: also that screen's specs,
    `pnpm test:e2e tests/e2e/<name>.spec.ts`. Only a release, or a change to the build, the
    content pipeline, the gates or the runners, needs the full `pnpm check` and `pnpm test:e2e`,
    which take about fifteen minutes and an hour. Run long commands in the background.

## Commits

Imperative, one line, what and where: `Add hint ladder to code-challenge steps`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
