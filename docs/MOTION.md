# Motion

Written 25 September 2026 as a plan; sections 2, 3 and the status below are now the spec.
It lifts Understory from a calm, correct app to one that feels made by hand, without
turning a place for learning into a showreel. References: lenis.dev and gsap.com.

## Status, 25 September 2026

Built (phases 1 to 4 of section 7):

- **Everywhere:** titles arrive line by line (`<Title>`), `data-arrive` groups rise in on
  arrival or when scrolled to, `Figure` counts up, the nav indicator slides, the theme
  spreads from the toggle, the mark draws once per session, the bar gains its hairline on
  scroll, smooth wheel scrolling in `(app)`.
- **Today, Learn, Map, Signal:** arrivals as in section 4. The Map legend and concepts
  settle into their weight, and its filter uses Flip. Learn chapters arrive when a part
  opens.
- **Lesson player:** steps slide in (`.step-advance`), a right answer draws its tick,
  "Not quite" switches on its lightbulb, test results stream in.

Changed from the plan, on purpose:

- No shake on a wrong answer. Feedback treats a wrong answer as a gap, not a failure, and
  a shake says the opposite.
- No ScrollTrigger yet: IntersectionObserver and CSS scroll timelines cover what is built.
- CSS holds arriving elements before paint (with a 2 s failsafe) instead of JS, because JS
  runs after first paint and the title would flash.
- Steps only move forward in a lesson, so "directional" is a slide in from the right.

Not built yet: the Learn spine and pinned part numerals, the shared-element morph from a
lesson row to the lesson title, the milestone scroll story, link underline wipes, and
phase 5 (labs and stepped figures, waiting for the figures kit to land).

Found on the way: the reduced-motion rule in `globals.css` gave every element a 0.01 ms
transition, which made layout read in the same frame stale (the box model lab). It is 0s.

## 1. The idea

Understory is a magazine you read and an instrument you use every day. Expensive
magazines and expensive instruments share one quality: **everything arrives with intent
and nothing gets in the way.** So the motion follows one rule:

> **Arrival is choreographed. Work is instant.**

- Pages, titles, figures and diagrams _arrive_: masked line reveals in the serif,
  counting figures, lines that draw. Slow enough to feel (600 to 900 ms), never blocking
  input, and only the first time per visit.
- Anything the learner is _doing_ (typing, answering, running code, filtering) answers
  within 150 to 300 ms, as today. Nobody waits for an animation to finish before the next
  question.
- **Motion explains.** The richest motion goes where it teaches: a value moving between
  queues in the event loop lab, a B-tree splitting, a concept gaining weight as it
  becomes solid. Motion that only decorates stays small.

What stays: flat, no gradients, no glow, no confetti, one accent, four sizes, three
weights. Premium here comes from typography in motion, timing and restraint, not effects.

## 2. What changes in the laws

`docs/DESIGN.md` law 11 and the Motion row in `docs/ARCHITECTURE.md` say "no motion
library, under 300 ms". This plan replaces them with:

- **Two tempos.** _Interaction_ 150 to 300 ms (unchanged). _Arrival_ 600 to 900 ms, for
  entrances only, staggered by 40 to 80 ms, never longer than 1.2 s from start to end.
- **Two libraries, one gate.** GSAP (core, ScrollTrigger, SplitText, Flip, DrawSVG,
  CustomEase: all free since 2025, GSAP standard licence) and Lenis (MIT). Both are
  imported only inside `src/features/motion/`. Screens use its primitives, never `gsap`
  directly. A ratchet in `design-laws.test.ts` enforces this.
- **React View Transitions** (built into Next 16, `import { ViewTransition } from
'react'`) for route changes and shared elements. GSAP never does page transitions.
- **Motion tokens** in `tokens.css`: `--dur-press` 150, `--dur-answer` 240, `--dur-arrive`
  700, `--dur-stagger` 60, `--ease-out` (existing), `--ease-arrive` (a softer expo out).
  `motion/tokens.ts` reads them; a test keeps both in step. No literal duration in a
  component.
- **Reduced motion is a real design**, not a switch-off: nothing moves, figures show their
  final value, lines appear drawn. The head script only sets `html[data-motion='on']` when
  motion is allowed, so under reduced motion nothing is ever held back. Lenis turns itself
  off (`respectReducedMotion`).
- **Content never depends on motion.** CSS holds an arriving element back from the first
  frame only while `data-motion` is on, and a failsafe shows it after 2 s whatever
  happens to the script.

## 3. The foundation (`src/features/motion/`)

Built in phases 1 and 2.

| Piece                   | What it does                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gsap.ts`               | The only file that imports GSAP. Registers SplitText and `useGSAP`; `motionAllowed()` reads the flag and the live media query.                                                                                                                                                                                                                                                 |
| `init-script.ts`        | Runs in `<head>` before paint: sets `data-motion` and, once per session, `data-mark-draw`.                                                                                                                                                                                                                                                                                     |
| `SmoothScroll`          | Lenis in the `(app)` layout only. Wheel and trackpad; touch stays native (`syncTouch: false`). `lerp` 0.1, driven by `gsap.ticker`, `allowNestedScroll` so code blocks and lab panels keep their own scroll, `stopInertiaOnNavigate`. A lesson in `(focus)` scrolls natively.                                                                                                  |
| `Arrival`               | Mounted once in the root layout. On each route it gathers `[data-arrive]` and plays what is on screen as one timeline, everything starting within 0.5 s. What is below the fold arrives when scrolled to (IntersectionObserver, no ScrollTrigger needed). A MutationObserver picks up content that appears later. A page seen before in this visit settles three times faster. |
| `data-arrive`           | `title` (lines rise out of a mask), `rise` (fade and 16 px lift), `stagger` (children rise in turn), `draw` (grows from the left). `data-arrive-wait` holds a placeholder back until the real content is there.                                                                                                                                                                |
| `<Title>`               | Every `.t-title`. Rendered as one HTML string (`static-html.ts`), because SplitText restores a title by resetting `innerHTML`, which would orphan text nodes React owns. Accepts text, `<span>`, `<em>`, `<strong>`, and escapes everything.                                                                                                                                   |
| `<CountUp>`             | Used by `Figure`. Whole numbers count from 0, or from the old value when they change. It writes to the text node React rendered, never replaces it.                                                                                                                                                                                                                            |
| `theme-reveal.ts`       | The new theme spreads as a circle from the toggle (`startViewTransition` plus a clip-path on `::view-transition-new(root)`).                                                                                                                                                                                                                                                   |
| `src/styles/motion.css` | Pre-paint holding and its failsafe, the mark drawing, the header hairline on scroll (a CSS scroll timeline), route crossfades and the nav indicator's slide.                                                                                                                                                                                                                   |
| Nav indicator           | A `<ViewTransition name>` shared element under the current place, so it slides on navigation.                                                                                                                                                                                                                                                                                  |

Scroll-linked drawing (the Learn spine) uses CSS scroll timelines, not ScrollTrigger, so
it costs no script. Flip and DrawSVG are added in the phases that need them.

Measured cost: GSAP core, SplitText and Lenis add 33 KB gzipped (see the lesson budget in
`tests/e2e/bundle-budget.spec.ts`).

## 4. Screen by screen

### Everywhere

- **The mark draws itself** once per session: canopy, understory (accent), forest floor,
  one stroke after the other, 700 ms. Then never again that session.
- **Nav indicator**: a 2 px rule slides under the active place (Flip), on the top bar and
  the phone tab bar. Today the active state just switches.
- **Theme toggle**: the new theme spreads out as a circle from the toggle
  (`document.startViewTransition` plus a `clip-path` circle). Reduced motion: a
  crossfade.
- **Links and buttons**: underline wipes in from the left and out to the right (the
  lenis.dev hover). The trailing arrow on a primary action nudges 4 px. Pressed stays
  `scale-98`.
- **Sticky bar**: gains its hairline only after you scroll (the rule draws), so a page at
  rest has no line across it.

### Today

- The title arrives line by line; the muted half ("None lost yet.") follows one beat later.
- The four figures count up in turn, 60 ms apart. The gap figure lands last, in the
  accent, because that is the thing to act on.
- The weekly goal line draws to its value.

### Learn (the journey)

The strongest scroll moment, because a journey is literally a path.

- **A spine**: one hairline runs down the left of the journey and draws with scroll
  progress (`useScrollProgress`). The finished part is solid ink, the rest faint, and
  "You are here" is the accent node.
- **Chapter numerals**: each part's number (`01` to `07`) is set large in mono and stays
  pinned beside its part while you read through it (plain `position: sticky`), then hands
  over to the next. Editorial and calm.
- Opening a part or chapter animates its height and staggers its lessons in (Flip),
  instead of snapping open. "Open all parts" ripples down.
- Search results reorder with Flip.
- A lesson row's title morphs into the lesson's title when you open it (shared element).

### Map

"Weight is what you hold" becomes something you see.

- On arrival, concepts **settle into their weight**: all start faint, then each takes its
  real weight (Geist is a variable font, so 400 to 600 animates smoothly). Solid and
  fluent concepts visibly get heavier. Gaps land last in the accent.
- The All / Started / Gaps filter uses Flip: concepts that stay glide to their new place,
  the rest fade. Nothing jumps.
- The legend shows each state as a live sample.

### Lesson player (focus mode)

Fast first. Every answer, run and step answers in under 300 ms.

- **Step change is directional**: forward slides in from the right, back from the left
  (View Transition types), 240 ms. It replaces the current `step-in` rise.
- **Right answer**: the tick draws as a stroke (DrawSVG) instead of popping, the step's
  segment fills, and "+10 XP" counts up in the mono face. **Wrong answer**: a 4 px
  sideways shake of the choice, once, 200 ms, then the explanation arrives. Reduced
  motion: no shake, the colour change alone.
- **Code output** streams in line by line (20 ms apart), so a run feels like it ran.
- **Hints** unfold one rung at a time.
- The editor, the key rows and the full-screen editor are left alone. That work was hard
  won on phones.

### Lesson summary and milestones

The one ceremony. Still no confetti.

- The summary title arrives in the serif, the XP counts up, then each concept practised
  in the lesson steps up a weight, one after another, like on the Map.
- A milestone page tells what you can now build as a short scroll story: each capability
  line reveals as it enters, the part's numeral stays pinned, the spine completes.

### Signal (news)

- Editorial: headlines reveal line by line, the date header stays pinned as you scroll
  through a day, links underline on hover.
- No marquee. Anything that moves on its own for more than 5 s needs a pause control
  (WCAG 2.2.2), and a news list does not need one.

### Labs and figures

Where motion earns the most.

- **Stepped figures** (`src/features/lesson-player/figures/kit/`, in progress in another
  session) get a Flip-based transition between steps: a value that moves is seen moving.
- **Event loop stepper**: tasks travel between the call stack and the queues.
- **B-tree explorer**: nodes split and keys slide up to their parent.
- **Request journey**: the request dot travels along the drawn path.
- Diagrams draw their strokes as they scroll into view, once.

## 5. What we deliberately do not do

- No custom cursor, no cursor follower, no magnetic buttons. They hurt precision and
  add nothing to learning.
- No scroll-jacking, no snap sections, no horizontal scroll sections in the app.
- No parallax on text. At most 8 px of depth on a large figure.
- No smooth scroll on touch devices, and none in focus mode.
- No motion that replays every visit. Arrival runs once per page per session. Return
  visits settle in 200 ms.
- No new colours, gradients, blurs or glows to "look premium".

## 6. Quality gates

- **Ratchets** in `design-laws.test.ts`: `gsap` and `lenis` imported only in
  `src/features/motion/`, and no literal duration, delay or stagger in that folder outside
  `tokens.ts`. `motion-tokens.test.ts` keeps CSS and TypeScript tempos in step.
- **E2E**: axe runs with `reducedMotion: 'reduce'`, which also fixes the known flake
  where axe caught `/settings` mid-transition. A new `motion.spec.ts` runs with motion on
  and checks that every title and figure ends visible and at full opacity, that nothing
  scrolls sideways during a reveal, and that CodeMirror scrolls under Lenis.
- **Performance**: CLS stays 0, LCP moves by less than 100 ms, 60 fps on a mid-range
  phone (Chrome trace at 4x CPU throttling), INP unchanged in the lesson player.
- **Offline**: the service worker precaches the motion chunks.
- **Review**: every screen at 390, 768, 1024, 1440, light and dark, motion on and off.
  A screen recording of each signature moment goes in the PR.

## 7. Order of work

Each phase ends green (`pnpm check`, `pnpm test:e2e`) and is committed on its own.

1. **Foundation.** Law and decision updates, motion tokens, packages, `MotionProvider`,
   Lenis in `(app)`, the ratchets, reduced-motion e2e. No visible change yet except
   smooth wheel scrolling.
2. **The vocabulary.** `SplitTitle`, `Reveal`, `CountUp`, `DrawLine`, `useFlip`,
   route transitions, nav indicator, theme reveal, link hovers, the mark drawing.
3. **Today, Learn, Map.** The first real "levels up" moment. Review screen recordings
   with a few users here before going further.
4. **Lesson player, summary, milestones.** Answer feedback, directional steps, output
   streaming, the summary ceremony.
5. **Labs and figures.** Flip transitions in the stepper kit and the four live labs.
6. **Signal and polish.** Editorial reveals, the performance pass, recordings, this file
   rewritten from plan into spec.
