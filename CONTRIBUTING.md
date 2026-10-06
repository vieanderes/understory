# Contributing to Understory

Thank you for wanting to help. Understory gets better every time someone fixes a slip,
explains an idea more clearly, or builds something that makes learning easier. This guide
says how to make a contribution that lands quickly.

## Ways to help

- **Fix something.** A wrong fact, a broken exercise, a typo, a bug on a phone.
- **Improve a lesson.** A clearer explanation, a better example, a new exercise.
- **Add a lesson or a course.** New methods and concepts, above all in AI engineering, are
  especially welcome.
- **Build for the product.** A UI feature, a lab, an accessibility or performance fix.
- **Improve Scout.** The tutor's prompts and harness, its MCP server, a new provider.
- **Report and discuss.** A clear issue is a contribution too.

Good first tasks carry the `good first issue` label.

## Before you start

- **Search the issues** to see whether someone is already on it.
- **Open an issue first** for anything larger than a small fix: a new lesson, a new feature,
  a change to a rule or a schema. Describe the problem and your proposed shape. Agreeing on
  it first saves you from building something that cannot be merged.
- **Small fixes** (a typo, a broken link, an obvious bug) can go straight to a pull request.

## Set up

You need Node 24 and pnpm.

```sh
git clone https://github.com/vieanderes/understory.git
cd understory
nvm use
pnpm install
pnpm dev           # http://localhost:3000
```

Then read, in this order:

1. [`AGENTS.md`](AGENTS.md): the laws of the codebase and where everything lives. They apply
   to people as much as to coding agents.
2. [`docs/ROADMAP.md`](docs/ROADMAP.md): what is done, what is open, and in what order.
3. The guide for your area, listed below.

## Making a change

### Everywhere

- **One change per pull request.** A fix and a refactor are two pull requests. Small pull
  requests get reviewed sooner; aim for something a reviewer can read in one sitting.
- **Match the code around you**: its naming, its structure, its comment density. Comments
  explain why, not what.
- **Rules are written test first.** Anything in `src/core` (mastery, scheduling, scoring,
  grading) starts with a failing test, and `src/core` keeps 95% coverage.
- **British English**, and no marketing language, exclamation marks or em-dashes in the
  interface.
- **Never name a real company's product** in lessons or examples, including coding
  assessment platforms. Describe the format instead ("a timed online coding test").

### Lessons and courses

Read [`docs/CONTENT-GUIDE.md`](docs/CONTENT-GUIDE.md) for what a lesson file may contain and
[`docs/WRITING-GUIDE.md`](docs/WRITING-GUIDE.md) for how it should read.

- One idea per screen. Explain before you test. Every scored step asks the learner to do
  something a working engineer does: write, fix, read, review or decide. No mental
  arithmetic.
- Examples are plain and generic: a shopping cart, a booking, a chat. No recurring product,
  no real person's or company's project.
- Every solution must pass its own tests, and every fact needs a source you have checked.
  Mark any reference you could not verify with `verified: false`.
- Say in the pull request when a lesson is new, so it can be marked as new for returning
  learners.
- Check your work with `pnpm validate:content` and `pnpm content:readability`.

### Interface

Read [`docs/DESIGN.md`](docs/DESIGN.md) and [`docs/MOTION.md`](docs/MOTION.md).

- Colours, sizes, radii and type come from `src/styles/tokens.css` only. No arbitrary
  Tailwind values, literal colours, gradients, glow or emoji as icons. A test enforces it.
- Desktop and phone are equal. Check every changed screen at 390, 768, 1024 and 1440 px, in
  light and dark, and attach screenshots to the pull request.
- Every route passes axe (WCAG 2.2 AA) in the end-to-end suite.

### Scout, the assistant and MCP

- The port is `src/core/ports/assistant.ts`, the providers and the MCP server are in
  `src/adapters/assistant/`, the tutor is in `src/features/tutor/`, and the design is in
  [`docs/ONLINE-TEST.md`](docs/ONLINE-TEST.md), section 6.
- Scout runs on the learner's own Claude. Never add a server-side key, never call a paid API
  on a visitor's behalf, and never store a learner's key on the server.
- Scout stays out of anything that measures the learner: timed tests, checkpoints, test-outs
  and placement.
- In plan mode Scout's structure travels as `scout-ask` and `scout-path` blocks
  (`src/core/planner/protocol.ts`). Anything shown about a draft (lessons, minutes, weeks,
  gaps) is counted from the course in `src/core/planner/`, never read from the reply. A new
  block kind needs a schema there, a renderer in `src/features/tutor/planner/` and a line in
  `PLANNER_RULES`.

### Keeping the README current

The README is the front door, and I would love it to stay up to date without resting on one
person. If your change adds a feature, changes a screen the README shows, or alters anything
it describes (a path, a count, a command), please update the README in the same pull
request, or suggest the change in the description if you are not sure how it should read.

Screenshots live in `docs/assets/readme/`, one per theme: `<name>-light.png` and
`<name>-dark.png`. To match the ones already there:

- Desktop at 1440 by 900, phone at 390 by 844, both at a device scale of 2, with reduced
  motion and the Next.js dev indicator hidden.
- Show the feature doing something real: tests passing, a live preview, a real answer.
- Resize desktop shots to 1600 px wide. Keep phone shots as they are.
- Reference them with a `<picture>` element, dark source first, as the README does.

## Before you open a pull request

```sh
pnpm check:fast                            # every change, about a minute
pnpm test:e2e tests/e2e/<name>.spec.ts     # any screen you changed
```

`check:fast` runs the content rules, lint, types and unit tests side by side, and runs
solutions only for the lessons you changed. A change to the build, the content pipeline, the
solution gates or the code runners needs the full `pnpm check` and `pnpm test:e2e`; a
maintainer also runs those before a release.

## Commits

Write commit messages the way the history already reads:

- **Subject:** imperative mood, what changed and where, no full stop, ideally under 72
  characters. `Add hint ladder to code-challenge steps`, not `fixed stuff`.
- **Body, when the reason is not obvious:** a blank line, then a few wrapped lines on why,
  and on any trade-off. Not a list of every file.
- One logical change per commit.

## Pull requests

- **Title** in the same style as a commit subject.
- **Description:** what changed, why, how you tested it, and screenshots for anything
  visible. The template asks for each. Link the issue it closes.
- **Draft pull requests** are welcome when you want early feedback.
- Keep the branch up to date with `main`, and answer review comments with a new commit
  rather than a force-push, so the conversation stays readable. It is squashed on merge.

## Review

- A maintainer reviews every pull request. Expect questions and requests for changes; they
  are about the work, never about you.
- Reviews are done as time allows, usually within a week. A friendly nudge after that is
  fine.
- A pull request can be closed if it does not fit the direction in the roadmap, with a
  reason. An issue first avoids that.

## AI-assisted contributions

Using an AI assistant is fine. You are still the author: read, run and understand every line
you submit, and be ready to explain it in review. Pull requests that were clearly generated
and never checked will be closed. This project exists because understanding the code
matters.

## Licensing

By contributing, you agree that your contribution is licensed like the rest of the
repository: code, design and documentation under the [MIT License](LICENSE), and lesson
content in `content/` under [CC BY-NC-SA 4.0](content/LICENSE). Contribute only work you
have the right to share under those terms.

## Conduct and security

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report security
issues privately, as described in [`SECURITY.md`](SECURITY.md), never in a public issue.
