# Vocabulary

Software engineering is a foreign language. The vocabulary at `/vocabulary` collects every
term the course teaches, explains each one plainly, links it back to where the course
teaches it, and lets a learner study the words the way they'd learn Spanish at the bus stop.

## What a learner gets

- **A dictionary.** Search by name, nickname or a misspelling; filter by area.
- **A page per word.** One plain sentence, then the real explanation, an everyday picture,
  code where it helps, the sentence as a colleague says it, its evil twin (the word it is
  always confused with) and related words.
- **Where you learnt it.** Links to the lessons that use the word, straight to the spot in
  the lecture: the terms table, a section, or the lesson itself.
- **A deck.** Add a word, or every word of an area at once. Reviews run on the same FSRS
  schedule as the recall cards. New words come a few at a time, so the deck never floods.
- **Drills.** Word to meaning, meaning to word, the word that fills a gap in a real sentence,
  the word a snippet of code shows, and a sixty-second speed round.
- **Fluency.** Per area, the words known out of the words there: Tourist, Conversational,
  Fluent, Native.

## Writing a word

One file per word: `content/glossary/<area>/<id>.yaml`. The file name is the id, lowercase
words joined by hyphens. The folder is the area. The schema is
`src/core/content/glossary-schema.ts`; `pnpm glossary:check` runs its rules in a second, and
`pnpm validate:content` runs them with everything else.

```yaml
term: idempotent # as people write it
aka: [idempotency] # other names people search by; plurals are found anyway
short: Safe to repeat, because doing it twice leaves things the same as doing it once.
explain: | # two to four short paragraphs of markdown
  Networks fail halfway. ...
analogy: A lift button. Pressing it five times calls the lift once.
example: # optional; code where code helps, at most 12 lines
  language: http
  code: |
    POST /payments HTTP/1.1
    Idempotency-Key: 7f3a9c
usage: Make the webhook handler idempotent, because the provider will send the same event twice.
twin: # optional: the word it is always confused with
  term: retry
  difference: How to tell them apart, in one or two sentences.
related: [retry] # optional ids
level: 2 # 1 everyone says it, 2 working vocabulary, 3 a deeper cut
lessons: [scale.idempotency] # optional: the lessons that teach it, pinned first
```

### Rules the checker enforces

- Ids are unique, and so are names: no term or alias may belong to two words.
- `related`, `twin` and `lessons` point at things that exist; a word is not its own twin.
- `short` is one sentence of at most 18 words and never says the word itself, because a
  drill shows it as the meaning and would give the answer away.
- `usage` says the word (or an alias), because the gap drill hides it.
- Code is at most 12 lines. No banned words, no em-dashes, generic examples
  (`docs/AUTHOR-BRIEF.md`, "Examples").

### The voice

`docs/WRITING-GUIDE.md` applies: warm, plain, short sentences, one idea at a time, British
English. Explain like you would to a bright fifteen-year-old who is new to the field, then
give the professional the precise version in the second paragraph.

- **short**: what it _is_, not what it is _for_. Picture four of them side by side as answer
  choices: each must pick out its word and only its word.
- **explain**: the problem first, then the idea, then the precise detail or the trap.
- **analogy**: something from everyday life. A cache is the snack drawer by your desk; the
  database is the supermarket.
- **usage**: a sentence a colleague says in a review, a meeting or a ticket. Sounds real.
- **twin**: the pair that trips people up (`==` and `===`, a process and a thread,
  authentication and authorisation). Write the difference so it sticks.
- **level**: 1 for words every engineer uses daily, 2 for the working vocabulary of the
  area, 3 for words a specialist uses. Level 1 words come first to a new learner.

## How it is built

- `scripts/lib/glossary.ts` reads the files, checks them, finds where each word appears in
  the lessons and lecture notes (`src/core/vocabulary/mentions.ts`) and writes
  `glossary.json` to the bundle, markdown and code rendered at build time.
- The deck lives in the event log: `words_added`, `words_removed`, `word_reviewed` and
  `word_round_finished`. Tiers, fluency, due words and XP are derived by the reducer and
  `src/core/vocabulary/`, never stored (`AGENTS.md`, law 3).
- A word's tier follows its FSRS stability: learning below a week, familiar from a week,
  fluent from three weeks. A lapse lowers stability, so a forgotten word drops on its own.
- A review earns recall XP, like a recall card. A speed round earns none: it is a game you
  can replay at once.

## Later

- Words in lessons that show their meaning when tapped. The lesson route is over its bundle
  budget, so the popover must load lazily.
- More words: one chapter at a time is a good first contribution.
