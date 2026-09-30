# Lab brief

How to build an Understory lab. A lab is a small deterministic simulator of one mechanism
that is hard to see: the event loop, a race between two buyers, a B-tree splitting. The
learner steps through it, changes one thing, and predicts what happens next.

Read first: `AGENTS.md` (the laws), `docs/DESIGN.md`, `src/styles/tokens.css`,
`src/app/globals.css`, `src/features/labs/contract.ts`, `src/features/labs/parts/`
(`LabFrame`, `Transport`, `usePlayback`), `src/components/ui/` (`Button`, `Segmented`,
`Figure`), and `docs/CURRICULUM.md` for the lessons your lab serves.

## Architecture

| Part   | Where                                                                                   | Rules                                                                                                                                                                                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine | `src/core/labs/<id>/`                                                                   | Pure TypeScript. No DOM, no Node, no React, no `Math.random`, no `Date.now`: randomness through a seeded `Rng` from `@/core/util`, time as simulated ticks. State in, state out. Strict TDD, 95% coverage. It must typecheck under `tsconfig.core.json`.                                                       |
| View   | `src/features/labs/<id>/`                                                               | React client components that draw engine state and send commands. Default export is the lab component taking `LabProps` (`preset`, `embedded`). Validate `preset` with zod and fall back to the default scenario.                                                                                              |
| Tests  | `tests/unit/core/labs/<id>/`, `tests/unit/ui/labs/<id>/`, `tests/e2e/labs/<id>.spec.ts` | Engine: every rule, and property tests for invariants with a seeded Rng. View: renders, steps, and changes the scenario by keyboard. E2E on both Playwright projects at `/labs/<id>`: steps work, no horizontal page scroll at 390 px, axe clean (tags wcag2a, wcag2aa, wcag21aa, wcag22aa) in light and dark. |

Compute every frame of a run up front from the engine (`frames = run(scenario)`), then the
view is a pure function of `frames[index]`. Stepping back is then free, and
`usePlayback(frames.length)` plus `Transport` give the same controls in every lab.

Do not edit `src/features/labs/registry.ts`. Report the entry to add:

```ts
{ id: '<id>', title: '...', question: '...', moduleId: '<module id>', load: () => import('./<id>') }
```

The lab is reachable at `/labs/<id>` once registered. While you work, register it
locally to test, and revert that line before you report (another agent may be editing the
same file). If you cannot avoid a conflict, say so.

## Correctness

The lab teaches a real mechanism, so the engine must follow the real rules: the HTML
Standard's event loop processing model, Postgres isolation semantics, the CSS flex
algorithm. Name the specification or source in a comment above the rule, and where the lab
simplifies, say what it leaves out, in the code and in a short "What this leaves out"
disclosure in the view. A lab that teaches a wrong model is worse than no lab.

## Design

A lab that breaks these rules is sent back.

- Tokens only. No arbitrary Tailwind values (`-[...]`), no literal colours, no `dark:`, no
  gradients, glow or blur. Dynamic geometry (a bar length, a position) may use inline
  `style` with numbers computed from data, never colours.
- One accent: the thing that is active right now (the running task, the row being locked).
  Success and danger only for verdicts (invariant holds, invariant broken). Everything else
  is ink, muted and hairlines. State is carried by position, weight and labels before colour.
- Diagrams are typographic: mono labels, hairline boxes (`border-border`), the 8 pt grid.
  Boxes that represent queues, stacks, rows and pages, not illustrations. SVG is fine for
  connectors and trees, using `currentColor` and token variables.
- Motion explains: an item moving from one queue to another may transition under 300 ms
  with transform and opacity. The global reduced-motion rule removes it.
- Everything works by keyboard and by touch. Targets 40 px. A `role="status"` line says in
  words what the last step did ("Microtask 'then A' ran. The task queue waits."), so the
  lab is usable without seeing the diagram.
- It fits 390 px without horizontal page scroll. A wide diagram scrolls inside its own
  focusable region, or reflows to a vertical arrangement on phones.
- Copy: British English, fewer exact words, no "Please", no exclamation marks, no em-dash
  characters, no marketing language.

`tests/unit/scripts/design-laws.test.ts` enforces several of these. Run it.

## Scenarios

Ship 3 to 5 named scenarios in plain, varied, realistic settings (a shopping cart, a room
booking, a chat, a bank transfer), with no recurring product and no real company or
project. Name a scenario after what it shows, not after a setting. Run from the plain case to the one that surprises experienced engineers. A `Segmented` or a select
switches scenario; the key parameters are editable with simple controls. Each scenario has
a one-line prediction prompt shown before the first step ("Before you step: which line
logs first?"), because predicting first is what makes the lab teach.

## Environment

```sh
export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH
```

No state-changing git commands. No dependency changes. Touch only your lab's folders and
test files. Other agents work in this checkout at the same time: ignore errors from files
that are not yours. `pnpm build:content` may fail while lesson authors are mid-edit: for
e2e use `lsof -ti tcp:3210 | xargs kill; pnpm exec next build --experimental-build-mode compile && pnpm exec playwright test tests/e2e/labs/<id>.spec.ts`
(the content bundle in `public/content/v1` already exists).

Run until green for your paths: your vitest files, `pnpm exec tsc --noEmit`,
`pnpm exec tsc --noEmit -p tsconfig.core.json`, eslint and `prettier --write` on your files,
`pnpm exec vitest run tests/unit/scripts/design-laws.test.ts`, and your e2e spec.

## Report

Under 200 words: files, test counts, the registry entry, the scenarios, what the lab
leaves out, anything unfinished. Save screenshots at 390x844 and 1440x900, light and dark,
to the scratchpad directory the lead session names, as `labs/<id>-<phone|desktop>-<light|dark>.png`.

## Running e2e next to other builders

Several builders run builds and e2e at the same time. Never use the shared `.next`
directory or port 3210. Pick your own pair and use it for both build and test:

```sh
export NEXT_DIST_DIR=.next-<your-lab-id> PW_PORT=<your port>
pnpm exec next build --experimental-build-mode compile && pnpm exec playwright test tests/e2e/labs/<id>.spec.ts
```

Delete your `.next-<id>` directory when you are done. If Next adds your directory to the
`include` list of `tsconfig.json`, remove that line again before you report.

## Budget

Work within the scope and budget the lead session gives you. If the task grows beyond
it, stop and report what is left instead of carrying on.
