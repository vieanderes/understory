# Scout's five roles

A design for growing Scout AI from one helpful assistant into five jobs a good mentor does:
Advisor, Librarian, Tutor, Editor and Roommate. Nothing here is built yet. Each role lands
as its own pull request, in the order of section 9.

## 1. Why

A learner who studies alone lacks five people: someone who plans the route with them, someone
who keeps them off bad sources, someone who finds the exact point they are stuck on, someone
who reads their work and says what to fix, and someone from outside the field who asks the
question nobody inside thinks to ask. Scout already does a little of each. This makes each one
deliberate.

## 2. What exists

| Role      | Today                                                                                                                        | Missing                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Advisor   | The planner (`mode: 'planner'`) asks why, time, deadline; reads placement and done lessons; drafts stages with a "why" each. | Destination, baseline in the learner's words, a cutlist, a milestone per stage.                      |
| Librarian | Every lesson carries curated references (`referenceSchema`: kind, `primary`, `verified`, a note). Scout cannot see them.     | Any access to the references, and a way to judge a source the learner brings.                        |
| Tutor     | `tutorSystemPrompt`: one-sentence answer, one example, a hint ladder on exercises.                                           | Diagnosis: finding the specific misconception before explaining.                                     |
| Editor    | "Ask Scout to push back" on an explain-back (`pushBackQuestion`): one follow-up question, no grade, no rewrite.              | The same discipline for code after a run, capstone write-ups and longer explanations; a revise loop. |
| Roommate  | Nothing.                                                                                                                     | A stranger's lens on the lesson.                                                                     |

## 3. Principles

These hold for every role, and come from the laws in `AGENTS.md` and the planner's decisions in
`docs/ARCHITECTURE.md`.

1. **The model proposes, the course decides.** Every structured reply is a fenced JSON block,
   validated in `src/core/` with zod. Lesson ids, reference ids and concepts are checked against
   the course; a block that fails is dropped and the prose still reads. Same protocol on all
   three providers, since MCP `reply` carries text only.
2. **Grounded in the course only.** No web search on any provider. The Librarian recommends
   only references the course already carries. Scout says when it does not know.
3. **Scout picks the role.** No role switch in the interface. The role comes from where the
   question was asked (section 3.1), and the prompt carries only the roles that place needs.
4. **Feedback, not answers.** The Tutor and Editor protect retrieval: they ask, point and
   check before they explain, and never rewrite the learner's work unasked.
5. **Scout never grades.** Nothing Scout says becomes an event that moves XP, mastery or
   scheduling. Law 3: events record facts, and a model's opinion is not one. The one
   exception is the learner's own act, such as marking a milestone met.
6. **The learner's data stays in the tab** until they ask Scout something. Context is built
   in the browser, as `plannerSituation` and `learnerSituation` are today.

### 3.1 How Scout picks the role

A pure function in core, `scoutRoles(entry)`, returns the roles whose rules go into the system
prompt. Fewer rules make a shorter, cacheable prompt and fewer wrong turns.

| Entry                                                  | Roles in the prompt        | Lead role |
| ------------------------------------------------------ | -------------------------- | --------- |
| `/plan`, the path builder, "Refine with Scout"         | Advisor                    | Advisor   |
| A button that sends the learner's own work (section 6) | Editor                     | Editor    |
| "Ask Scout" after a wrong answer or a failing run      | Tutor                      | Tutor     |
| Typed question inside a lesson                         | Tutor, Librarian, Roommate | Tutor     |
| Typed question on any other page                       | Librarian, guide rules     | none      |
| The online test                                        | none, unchanged            | none      |

With several roles in the prompt, one rule tells Scout which to take: confusion about the step
is the Tutor, "what should I read" is the Librarian, "how would someone outside see this" or
"why does this matter" is the Roommate. The panel shows no role name; the reply's shape is
enough.

## 4. Advisor: a personal curriculum

The planner already plans; it now plans with five named parts, each a field in `scout-path`.

| Part        | The question                                    | How Scout gets it                                              |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Destination | What will you be able to do or make at the end? | Asked first, always. A concrete outcome, not a topic.          |
| Baseline    | Where are you now on this?                      | Read from placement and done lessons; asked only for the gaps. |
| Sequencing  | In what order?                                  | Proposed by Scout from prerequisites; the stages, as today.    |
| Cutlist     | What do you leave out for now, and why?         | Proposed by Scout; the learner can pull an item back in.       |
| Milestones  | What will you produce that shows you have it?   | Proposed per stage; the learner can edit the wording.          |

The learner answers two questions (destination, then baseline where unknown), not five.
Sequencing, cuts and milestones are Scout's proposals, which is what an advisor is for.

**Protocol** (`src/core/planner/protocol.ts`), all fields optional so old paths still parse:
`destination` (one line), `baseline` (one sentence), `cut` (up to 8 items of `what`, `why`,
`later`, `lessons`) and a `milestone` (`output`, `check`) per stage.

`draftFromBlock` checks cut lesson ids against the course and keeps cut lessons out of every
stage. `restoreCut` brings an item back as a last stage, which `fixOrder` then places. Where a
stage ends a chapter, the rules let its capstone or checkpoint be the milestone.

**Rules added to `PLANNER_RULES`:** ask the destination first; a milestone is an output, never
"finish the lessons"; at most eight cuts, each with a reason tied to the destination; say in
one sentence what was cut.

**Storage.** `custom_path_set` keeps the new fields, optional, so older events still read; the
Swift decoder ignores keys it does not know. `milestone_marked { pathId, milestone, met }`
records the learner's word, keyed by the milestone's text so reordering stages keeps the mark,
and earns no XP.

**Screens.** The draft view and the path page show the destination under the name, the
milestone under each stage (with Mark met on the path page), and a collapsed "Left out for
now" list. In the draft an item with lessons can be brought back.

## 5. Librarian: defending the curriculum

**Source.** A build-time file, `/api/scout/library`, served static like the planner course:
every reference with a stable id (`<lessonId>#r<index>`), its kind, title, authors, year,
venue, note, `primary`, `verified`, and the lesson, chapter and concepts it belongs to. About
1,350 references; too large for a prompt, so the tab sends a slice:

- in a lesson: the lesson's and chapter's references, and the path's primary ones;
- elsewhere: the top 20 for the question, found with the vocabulary search already in the tab.

**What it answers.**

- "What should I read on X?" At most three, best first: `primary` and `verified` before the
  rest, then by fit to the learner's stage (a spec for someone at level 3, an essay for level
  1). One line each on why this one and what to skip in it.
- "Is this worth my time?" with a link or title the course does not carry. Scout cannot vet it
  and says so. It answers what it can: whether the topic is on the learner's path and when,
  whether a course reference covers the same ground, and the cut item it belongs to if any.
  That is the distraction defence: "this is in your cutlist, come back after stage 3."
- Never invents a source. A reference outside the slice is not recommended.

**Block.** `scout-reading { items: [{ id, why }] }`, one to three items. Ids are checked against
the library; the card shows title, kind, year, the note, and "Not yet checked by a person"
when `verified` is false.

## 6. Tutor: diagnose, then clear it up

**Protocol in the prompt**, for a question about the lesson:

1. If the question does not show what the learner thinks, ask one short question that would:
   "What do you expect this to print, and why?" Skip when it does.
2. Name the specific gap in one sentence: the wrong model, not the right answer.
3. Fix that gap only, with one small example aimed at it.
4. Check with one question the learner answers in a tap.

**Context it gets**, built in the tab:

- the step on screen, and its authored choice feedback, which names each misconception
  (`choice.feedback` in the schema). Scout matches the confusion to one of these first;
- for the lesson's concepts, the mastery state (`gap`, `introduced`, ...) and the last few
  `step_answered` events that were wrong with high confidence. Confident and wrong is the
  strongest sign of a misconception rather than a slip.

**Block.** `scout-check { question, options: [{ text, correct, feedback }] }`, two to four
options, exactly one correct, validated in core. It is drawn like a multiple-choice step and
records nothing (principle 5). A wrong pick goes back to step 2 with the pick in the turn.

**Entry.** "Ask Scout" next to a wrong answer and in a failing run's output sends the step,
the pick or the run, and starts in this role.

## 7. Editor: feedback on the learner's work

Real-time here means as soon as the learner asks, on their latest version; not as they type,
which would cost tokens and move text off the device unasked.

**Where.** Explain-back (today's push-back), a code challenge after a run, a capstone write-up,
and the explanation steps of chapter 33. Each sends the work with its rubric, the same way
`pushBackQuestion` does, through one core builder: `editorRequest({ kind, work, rubric, model? })`.

**Rules.**

- Quote the learner's own words or lines; never rewrite the whole piece.
- At most three notes, most important first, each tagged `keep`, `fix` or `missing`.
- One note must be a `keep` when something works, so they know what to repeat.
- End with one revision prompt. For explain-back, keep today's single follow-up question.
- No score, no "good job".

**Block.** `scout-review { notes: [{ tag, quote?, note }], next }`, drawn as a short list with
the quote highlighted. "Revise" puts the learner's text back in the field; the next request
carries both versions, and Scout says first what changed.

## 8. Roommate: a stranger's lens

**What.** Scout steps outside software and looks at the lesson as someone from another field
would: a biologist, a city planner, a musician, a cook. It asks one or two naive questions
that the field takes for granted, and offers one connection.

**Rules.**

- Name the field. Pick one far from the topic, and a different one next time
  (the last three go in the context).
- Questions first, connection second. The questions are the point.
- Every analogy says where it breaks, in one sentence. An analogy that misleads is worse than
  none.
- Short: three to five sentences. No blocks.

**Entry.** Automatic only, so no button: in a lesson, Scout takes this role when the learner
asks why something matters, for an analogy, or how someone outside would see it. Open
question 2 asks whether a quiet line at lesson end should invite it.

## 9. Build order

Each is one pull request, core and tests first, then prompt, block, screen, docs and an e2e
spec at 390, 768, 1024 and 1440 in light and dark.

1. **Advisor.** Extends a protocol that already works and changes what learners keep.
2. **Tutor.** Highest value per lesson; the misconception data is already authored.
3. **Editor.** Generalises push-back; needs the shared `editorRequest`.
4. **Librarian.** Needs the build-time library file and the slicing.
5. **Roommate.** Prompt only; smallest, and best judged once the others are in use.

Before the first: `scoutRoles(entry)` and the split of `assistantSystemPrompt` into role
sections, with the MCP server reading the same sections, so every provider behaves alike.

**Docs to update as each lands:** `docs/ONLINE-TEST.md` (Scout's section),
`docs/LEARNING-SCIENCE.md` (diagnosis, feedback, milestones), a row per protocol in the
`docs/ARCHITECTURE.md` decision table, and the Scout line in `docs/ROADMAP.md`.

## 10. Open questions

1. **Priority.** `docs/ROADMAP.md` puts product work fourth, after the known gaps, content and
   launch. Does this go ahead of them?
2. **Roommate entry.** A single line at lesson end, "See it from outside", or only when asked?
3. **Milestone proof.** On the learner's word, like capstones today, or with an Editor review
   attached when they mark it?
4. **Unverified references.** About 190 are `verified: false`. Recommend them with the label,
   or hold them back until checked?
5. **Cost.** The library slice and the Tutor's context add tokens on every lesson question.
   Measure on the API-key provider before landing, against a budget per question.
