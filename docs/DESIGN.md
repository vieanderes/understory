# Design

Understory is an instrument you return to every day and a magazine you read. It is calm,
typographic and flat. Gamification is carried by figures and weight, not by confetti.

Where a law below is enforced by a test, the test is named.

## Identity: Bluebell

Bluebells on a forest floor. Chosen on 17 September 2026 over an identity built on Kanagawa,
Inter and IBM Plex Mono.

| Role                    | Light               | Dark                |
| ----------------------- | ------------------- | ------------------- |
| Ground, paper           | `#f3f1ea`           | `#111613`           |
| Ink                     | `#161d19`           | `#e7e5da`           |
| Neutrals                | Greys leaning green | Greys leaning green |
| Accent, bluebell indigo | `#3a41b8`           | `#9aa1f7`           |

| Voice                    | Face                 | Where                         |
| ------------------------ | -------------------- | ----------------------------- |
| Title                    | Instrument Serif 400 | `.t-title` only               |
| Reading                  | Geist                | Everything read               |
| Figures and micro labels | Geist Mono           | `.t-label`, `.t-figure`, code |

Tokens live in `src/styles/tokens.css`, faces in `src/app/fonts.ts`. Components name
semantic tokens only, so a palette change is a change to that one file.

## Laws

1. **Hierarchy is the whole job.** One thing matters most on every screen. It is the
   largest, highest-contrast object. Everything else is quieter.
2. **Four sizes, three weights.** `text-sm` 13 px, `text-base` 16 px, `text-lg` 20 px,
   `text-xl` fluid 32 to 56 px. Weights 400, 500, 600. The display face appears only
   through `.t-title`. Tailwind's default scale is reset, so another size does not exist.
3. **The 8 pt grid.** `--spacing` is 0.5rem. `p-1` is 8 px, `p-0.5` is 4 px for tight
   in-group spacing. Three visible tiers: 8 to 16 inside a group, 24 to 32 between
   groups, 48 to 64 between sections. _Test: no arbitrary values._
4. **Colour is information.** Neutral ground, surfaces and text take about 60%, muted
   tones 30%, accent and status 10%. The accent marks exactly two things: the primary
   action and a knowledge gap. Status colours mean success, warning, danger. _Test: no
   literal colours outside the token file._
5. **Flat.** No gradients, no glow, no shadows at rest. One shadow exists, for things that
   float. _Test: no gradient, drop-shadow or blur utilities._
6. **Hairlines, not boxes.** Structure comes from spacing first, a 1 px rule second, a
   bordered surface last. A surface with one sentence and no action is a paragraph.
7. **Two voices plus mono.** Titles, reading text, and the mono face for every figure,
   micro label, tag and meta line (`.t-label`, `.t-figure`). Figures are tabular.
8. **The number is bigger than its name.** In a label and value pair the value wins.
9. **State by weight.** The mastery map encodes state in type weight and one accent:
   unseen faint, assumed muted, practised regular, solid medium, fluent semibold, gap accent.
   No palette of badge colours.
10. **Every interaction answers.** Default, hover, pressed (`active:scale-98`),
    focus-visible (one 2 px accent ring everywhere), disabled, loading. Targets are 40 px
    or more (`size-5`, `h-5`, `h-6`).
11. **Arrival is choreographed, work is instant.** Two tempos. Interaction (a press, an
    answer, a run, a filter) answers in 150 to 240 ms. Arrival (a title, a figure, a
    diagram entering) takes up to 700 ms per element, staggered, never 1.2 s in total, and
    runs once per visit. Transform, opacity and clip only. Motion explains before it
    decorates. `prefers-reduced-motion` gets a still design: final values, drawn lines,
    crossfades at most. GSAP and Lenis are imported only in `src/features/motion/`; route
    changes use React View Transitions. Tempos are tokens. See `docs/MOTION.md`. _Tests:
    the motion gate and token parity._
12. **One icon library.** lucide, 2 px stroke, 16 / 20 / 24. Never an emoji or a glyph.
    Icon-only controls carry `aria-label` and `title`.
13. **Fewer, exact words.** British English. No "Please", "successfully", "Oops", no
    exclamation marks, no em-dashes, no marketing language. Buttons are Verb or Verb +
    Noun. _Test: copy ratchet._
14. **Themes swap variables.** Components never write `dark:`. `data-theme` on `<html>` is
    set before first paint by an inline script. _Test: no `dark:`._
15. **Legible first.** Every text token reaches 4.5:1 on every ground, in every identity
    and theme. _Test: `token-contrast.test.ts`._ axe runs on every route in both themes
    on desktop Chromium and phone WebKit.

## Layout

- `.frame`: max 1440 px, side padding 16 / 32 / 48 px.
- Grid: 4 columns on phones, 12 from `md`, 32 px gutters (`gap-x-4`).
- Reading measure: 65ch (`.prose-measure`).
- Masthead: Practice, Progress and News open with `PageHead`
  (`src/components/layout/PageHead.tsx`): label, title, one-sentence lede, and a right-hand
  column on the same baseline, usually a `Ledger` of figures. The page's one primary action
  sits directly under it, in a bordered panel, above the fold at 1440.
- **Places**: four, one job each. Home (what to do today), Learn (your path), Practice
  (topics and tests), News (the daily edition). The Library (every path, lesson, lecture,
  lab and test) and Settings are utilities, drawn smaller, never a place to choose between.
  Words are the same everywhere: Course, Parts, Chapters, Lessons; a path has Stages, each
  with its lessons and its tests, labs and practice.
- **Desktop**: a rail with the four places, and the Library, Settings and theme at its foot;
  lessons put the question across the top, then code left and answers right on one top
  edge; keyboard shortcuts and a command menu. Scout AI opens as a column beside the page,
  never over it: from lg on a focus screen, from xl in the shell (below that it floats as a
  card), and it stays open across steps and pages until closed. On a phone it fills the
  screen, follows the visual viewport so its question box sits just above the keyboard, and
  holds the page behind it still. There is no mode switch: Scout plans only in the path
  builder, opened by its "Plan with Scout". In plan mode Scout's questions are chips (rounded, ink when picked, never the
  accent), a draft is one bordered card with the name, the stages, the size line in mono and
  Save path as the primary action, and Open draft replaces the conversation with the draft
  view inside the same column, settling in with `scout-view`. A lesson the path builds on but
  leaves out is a knowledge gap, so it is the one thing in the draft drawn in the accent.
- **Phone**: the four places in a bottom tab bar in the thumb zone, clear of the home
  indicator (`.pb-safe`), the Library (named) and Settings in the top bar;
  the primary action sits low; code and question share one viewport; session step types
  need no typing.
- Checked at 390, 768, 1024, 1440 and ultra-wide. Nothing scrolls sideways except code
  inside its own focusable region. _Test: e2e overflow check._

## Progress

`/progress` is where a learner sees where they stand. It answers two questions on the
first screen: how am I doing, and what now. A `PageHead` with four figures, then one
primary action (the most useful thing to do), then a short list to work on next. Below
that, one section each for activity (a weekly chart with a table behind a disclosure),
mastery (the concept map's atlas and index, folded), tests and exams, and chapters not
started. One `Show` control scopes every figure to everything, the learner's path, one
interest or one part, and keeps the choice in `?scope=`. A learner with nothing yet sees one
sentence and one action, never a page of zeros. `/map` redirects to `#mastery`.

## Figures

Illustrations in lessons are drawn as code: SVG with the kit in
`src/features/lesson-player/figures/kit/` (boxes, arrows, a decision diamond, stacks, queues,
a code panel, markers, dimension lines, a travelling token). They are technical drawings,
not pictures: crisp lines, a numbered key, and every state also said in words.

1. **One unit is one pixel.** Drawings are 320 wide and render at 1:1, so `text-sm` in a
   drawing is the page's 13 px, on a 390 phone and on a desktop alike. Lay labels out by
   hand at about 7.8 px per mono character, so no label ever crosses another.
2. **Markers and a key.** Numbered ink circles sit on the drawing; the key beside it names
   each one (it stacks under the drawing on a phone). The markers and key lines a step is
   about fill with ink. The drawing carries short mono labels only; sentences live in the
   key and the step text.
3. **Ink, not colour.** A part has four phases: future (a faint dashed outline, so the
   whole shape shows from the first step), now (ink, a 2 px line, a sunken fill), past (a
   quiet solid line) and hidden. The one solid ink block is the thing the figure arrives
   at: the answer, the content box. No accent, since a figure is neither the primary action
   nor a gap. No status colours unless the drawing is about success or failure.
4. **Dimension lines** carry measures, with a tick at each end and the number on the line.
   Draw to scale when the number is the lesson (the box model is).
5. **Stepped, never automatic.** A figure opens on step 1. Back and Next step it; Play runs
   it once and stops, and any press of Back or Next stops it too. Arrow keys, Home and End
   work inside the controls. Buttons at either end are `aria-disabled`, not `disabled`, so
   focus stays put.
6. **Every state in words.** The SVG is `role="img"`, named by its title and described by
   the current step's sentence, which is also a polite live region. Nothing is carried by
   the picture alone.
7. **Motion is law 11.** Only opacity and transform move, 200 to 250 ms, ease-out. Parts
   fade between phases, a token glides along the line it travels, a pointer turns forward
   round a loop. Reduced motion shows the same steps with no movement.
8. **Lazy.** Each figure is its own chunk, loaded when a step shows it. A lesson without a
   figure pays nothing for the kit. _Test: bundle budget._
9. **True to the lab.** Where a lab models the idea, the figure takes its states from the
   lab engine (the event loop figure does), so the two cannot disagree.

## The mark

Three strata: canopy, understory, forest floor. The middle layer carries the accent. It is
three strokes, reads at 16 px and needs no gradient. `src/components/brand/Logo.tsx`.

## Page review checklist

Run before a screen ships. All yes, or it is not done.

1. One clear primary element on first paint. Squint test: one bright thing, and it is the
   thing to do.
2. Four sizes and three weights, counted on the rendered page.
3. Three spacing tiers visible. Groups still read when the screenshot is blurred.
4. Every gap, padding and height on the 8 pt grid.
5. Colour used for meaning only. Accent on the primary action and on gaps, nowhere else.
6. Figures in the mono face, tabular, right-aligned in tables.
7. Every control has hover, pressed, focus-visible and disabled; async ones have loading.
8. Empty, loading and error states designed.
9. Interaction under 300 ms, arrival once per visit, and a still reduced-motion path.
10. Works at 390, 768, 1024, 1440. Light and dark both checked with real content.
11. Keyboard pass: tab order, visible focus, Escape closes, Enter submits, focus returns.
12. Delete-a-word pass on every label, button and sentence.
13. axe clean. Targets 40 px. Contrast from tokens only.
14. State that matters is in the URL.
