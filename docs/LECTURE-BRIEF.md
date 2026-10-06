# Lecture brief

How to write lecture notes (`notes.yaml`) and capstone solutions (`content/capstones/`).
Read `docs/WRITING-GUIDE.md` first: its voice applies here, its length limits do not.

## What a lecture is

Every lesson has a lecture: a page and a PDF that a learner reads straight through instead
of stepping through the lesson. It is built in this order:

1. **The big picture**: `summary` from the notes (or the lesson opening without notes).
2. **Remember**: `remember` from the notes (or the recap without notes).
3. **The lesson**: every step, turned into reading: explanations, worked examples with the
   right answer and why, the wrong answers people give and why they are wrong, every
   exercise with its full solution, model answers.
4. **Going deeper**: `sections` from the notes, then the lesson's deep dive.
5. **Common mistakes**: `pitfalls`.
6. **Interview questions**: `interview`.
7. **Test yourself**: the recall cards, question then answer.
8. **Sources**: the references.

Parts 3, 7 and 8 already exist. The notes add 1, 2, 4, 5 and 6. Read the whole lesson
(`lesson.yaml` and its challenge files) before writing, so the notes complement it and never
repeat it.

## `notes.yaml`

```yaml
summary: >-
  Two to four short paragraphs. What the thing is, the problem it solves, when you reach for
  it and when you do not. Someone who reads only this knows why the lesson exists.
remember:
  - The single most important sentence of the lesson, true on its own.
  - Three to eight in total, most important first. Each is one sentence, a fact or a rule
    you could say in an interview or apply at a keyboard.
sections:
  - title: How it works underneath
    body: |-
      The depth the steps skip: the mechanism, the edge cases, how real code uses it, one or
      two worked examples in fenced code. One to six sections, each 120 to 400 words.
pitfalls:
  - '**The mistake in bold.** Why people make it, and the fix.'
verify:
  - lens: breaks
    check: One sentence on what fails first when this idea meets real traffic or real data.
  - lens: tests
    check: One sentence on the test that proves it works, and what it could regress.
interview:
  - question: What an interviewer asks, in their words.
    answer: >-
      The answer to give. Point first, in one sentence. Then the reasoning. Then one
      trade-off or a "when not to". 60 to 180 words.
```

The schema is `src/core/content/notes.ts`. `pitfalls`, `verify` and `interview` are
optional, but give every lesson in chapters 20 to 28 at least three interview questions, and
every other lesson at least two when an interviewer would ask about the topic at all.

### Before you ship

`verify` is the checklist a senior engineer runs before shipping code that uses the
lesson's idea. The lecture prints it as "Before you ship", after "Common mistakes" and
before "Interview questions", and the narration reads it in the same place. Each item has a
`lens` and a `check`, and the lecture groups the checks by lens:

| `lens`     | Printed as     | The question it answers                                  |
| ---------- | -------------- | -------------------------------------------------------- |
| `breaks`   | What breaks    | What could break?                                        |
| `scales`   | What scales    | Will it hold at 10x?                                     |
| `confuses` | What confuses  | What will confuse the next person?                       |
| `leaks`    | What leaks     | What could this expose?                                  |
| `tests`    | How to test it | How would you prove it works, and what could it regress? |

Two to eight items. A check is one sentence of 30 words or fewer, specific to this lesson's
idea: "A retry without a cap turns one slow dependency into a queue of retries" is a check;
"Think about errors" is not. Use the lenses that matter for the idea, not all five every
time, and keep the voice rules below. `pnpm lecture:check` fails a check that runs long or
holds two sentences.

### Rules

1. **Correct first.** Every claim is true for the versions the course uses (Node 24,
   TypeScript 5.9, React 19, Next.js 16, Python 3.13, PostgreSQL 17 and 18). Run every code
   block you write: `node`, `npx tsx`, `python3`. If you are not sure, leave it out.
2. **Complement, don't repeat.** The lesson steps are printed right above your sections.
   Add the why, the mechanism, the edge cases and the real-world use.
3. **The remember list is the highlight.** A reader who reads nothing else should be able to
   answer most questions about the topic from it. No filler like "practice is important".
4. **Interview answers are model answers.** Write what a strong senior candidate says:
   precise terms, a concrete example, a trade-off. Not a list of keywords.
5. **Voice.** British English, "you", contractions welcome, sentences mostly under 20 words.
   No em-dashes (use a comma, a colon or a full stop), no exclamation marks, no "Please", no
   "simply" or "just", no marketing words.
6. **Examples are generic.** A shopping cart, a booking system, a chat, a to-do list, a
   library catalogue. Never a recurring product, and nothing about the course owner.
7. **Markdown subset.** Paragraphs, `**bold**`, `*italic*`, `` `code` ``, links, lists and
   fenced code with a language (`js`, `ts`, `tsx`, `python`, `sql`, `bash`, `json`, `yaml`,
   `http`, `html`, `css`, `text`). No headings inside a body (the section title is the
   heading), no tables, no raw HTML.
8. **Bold sparingly.** Bold marks the one phrase per paragraph a skimming reader must see.

## Capstone solutions

`content/capstones/<partId>.yaml`, one per part (`firstcode`, `languages`, `interfaces`,
`servers`, `production`, `aiengineering`, `senior`). The brief is in
`content/course/course.yaml`. The schema is `capstoneSolutionSchema` in
`src/core/content/notes.ts`:

```yaml
summary: >-
  The shape of the solution in one paragraph.
remember:
  - A decision the solution rests on, and why.
sections:
  - title: 1. The data model
    body: |-
      What to build first, the code that matters (complete and runnable where it is the
      point), and the reasoning. Walk through the whole build in order.
checklist:
  - Something a reviewer checks by looking, for example "Every form field has a label".
```

A capstone solution is a worked reference, not a sketch: the real files that matter, in
full where they are short, the decisions and the trade-offs, the tests, and what a reviewer
checks. It uses only what the part's chapters taught. Aim for 2,500 to 6,000 words.

## Checking

```bash
pnpm lecture:check                     # every notes.yaml and capstone file
pnpm lecture:check content/course/22-system-design   # one chapter
```

It checks the schema and the voice rules above. `pnpm validate:content` runs the same checks.
