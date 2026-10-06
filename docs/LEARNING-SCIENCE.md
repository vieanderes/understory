# Learning science

This file records the evidence Understory is built on, and the exact rules the evidence
became. It came out of the planning research on 2026-09-17. Every rule in sections B and C is
a pure function in `src/core` with unit tests.

## Citation status

- **[V]** Authors, year and venue were confirmed by web search during planning. The five
  sources added with parts on 23 September 2026 were confirmed by matching title, authors,
  venue and pages against their DOI records (Crossref API, fetched with curl).
- **[M]** Cited from memory and not re-checked. Check these before they ship in a lesson.

## The motivating study

Shen, J. H. and Tamkin, A. (2026). How AI impacts skill formation. arXiv 2601.20245. [V]

- **Design.** 52 junior software engineers completed coding tasks with Python's Trio library.
  They were randomly assigned to code with AI assistance or by hand. The study had a warm-up
  phase, the main tasks and a comprehension quiz. All participants received a problem
  description, starter code and a brief explanation, which mimics self-guided learning.
- **Result.** The AI group scored 50% on the quiz against 67% for the manual group, nearly two
  letter grades lower (Cohen's d = 0.738, p = 0.01). The AI group finished about two minutes
  faster, which was not statistically significant.
- **Where the loss sat.** Conceptual understanding, code reading and debugging.

Six interaction patterns were observed.

| Pattern                       | Outcome    | Description                                                                                |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| AI delegation                 | Low score  | Relied entirely on AI for code generation. Fastest completion, poorest comprehension.      |
| Progressive AI reliance       | Low score  | Started with questions, then delegated all coding to AI.                                   |
| Iterative AI debugging        | Low score  | Used AI to verify and debug code instead of building understanding.                        |
| Generation-then-comprehension | High score | Generated code, then asked follow-up questions to understand it.                           |
| Hybrid code-explanation       | High score | Requested explanations alongside generated code.                                           |
| Conceptual inquiry            | High score | Asked only conceptual questions and resolved errors independently. Second fastest overall. |

The authors recommend cognitive effort, including getting painfully stuck, as part of mastery.
Understory trains the skills the study found eroded.

## Two corrections made during planning

- Li et al. is Li, Hew and Du, ETR&D 72(2), 765 to 796. It went online in 2023 and the issue
  is dated 2024. Its headline finding matters for section C: gamification raises autonomy and
  relatedness but has minimal effect on competence. Competence has to come from the mastery
  model, not from the game layer.
- The 2025 expertise-reversal meta-analysis is Tetzlaff, Simonsmeier, Peters and Brod, Learning
  and Instruction 98, 102142. The effect is asymmetric: helping novices (d = 0.505) gains more
  than withholding help from experts (d = -0.428). When in doubt, default to Guided.

## A. Design principles

| #   | Principle                                                | Mechanism                                                                                                                                                                                  | Feature                                                                                                                                               | Citation                                                                                                                                                       |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Retrieve, do not reread                                  | Recall strengthens memory. Rereading only feels fluent, and learners do not choose testing unprompted.                                                                                     | Every lesson ends in recall cards. Prose steps earn nothing. There is no "mark as read".                                                              | Adesope, Trevisan and Sundararajan 2017, Rev. Educ. Res. 87(3) [V]; Karpicke, Butler and Roediger 2009, Memory 17(4) [V]                                       |
| 2   | Space by predicted forgetting                            | The best gap grows with the retention interval. Review near R = 0.9.                                                                                                                       | FSRS schedules both fact cards and exercise templates. The daily queue is built from R.                                                               | Cepeda et al. 2006, Psych. Bull. 132(3) [V]; Ye, Su and Cao 2022, KDD '22 [V]                                                                                  |
| 3   | Interleave confusable concepts                           | Discrimination learning (g = 0.42). It works best when categories are similar, and learners prefer blocking although it is worse.                                                          | Sessions mix confusable pairs: `==`/`===`, flex/grid, the isolation levels, task/microtask. The closing screen says once why it felt harder.          | Brunmair and Richter 2019, Psych. Bull. 145(11) [V]; Kornell and Bjork 2008, Psych. Science 19(6) [V]                                                          |
| 4   | Match assistance to prior knowledge                      | Guidance is redundant load for experts and essential for novices.                                                                                                                          | Guided or Challenge-first is chosen per module, never globally.                                                                                       | Tetzlaff et al. 2025 [V]; Renkl and Atkinson 2003, Educ. Psychologist 38(1) [V]                                                                                |
| 5   | Problem first, then consolidation, for prepared learners | A failed attempt activates prior knowledge and exposes the gap (g = 0.36, up to 0.58 at high fidelity). It reverses for young learners and for domain-general skills.                      | Challenge-first gives a time-boxed attempt. Consolidation then contrasts the learner's attempt with the canonical solution and one typical wrong one. | Sinha and Kapur 2021, Rev. Educ. Res. 91(5) [V]                                                                                                                |
| 6   | Read and trace before write                              | Tracing skill predicts writing skill, and the skills build in order.                                                                                                                       | The step order inside a concept is always predict/trace, arrange, fix, write, explain.                                                                | Lopez, Whalley, Robbins and Lister 2008, ICER '08 [V]; Xie et al. 2019, Comp. Sci. Educ. 29(2-3) [V]; Sentance, Waite and Kallia 2019, ibid. [V]               |
| 7   | Parsons with given subgoal labels, adaptive              | It lowers load while keeping structure decisions. Given labels beat generated labels.                                                                                                      | The Parsons step has labelled groups. After two failures it removes a distractor or merges two blocks.                                                | Morrison, Margulieux, Ericson and Guzdial 2016, SIGCSE '16 [V]; Ericson, Foley and Rick 2018, ICER '18 [V]                                                     |
| 8   | Prompt self-explanation                                  | Generating causal links gives g = 0.55.                                                                                                                                                    | Explain-back with a rubric self-grade. One "because" prompt inside each worked example.                                                               | Bisra, Liu, Nesbit, Salimi and Winne 2018, Educ. Psych. Rev. 30(3) [V]                                                                                         |
| 9   | Keep thinking in the loop with AI                        | Delegation cut comprehension. Conceptual inquiry and generation-then-comprehension preserved it. AI users also wrote less secure code while believing it more secure.                      | The ai-review step, the unplugged editor, and a lesson that teaches the protocol (B5).                                                                | Shen and Tamkin 2026, arXiv 2601.20245 [V]; Perry, Srivastava, Kumar and Boneh 2023, CCS '23 [V]                                                               |
| 10  | Commit and rate confidence before feedback               | High-confidence errors are hypercorrected. Failed pre-tests still help.                                                                                                                    | A three-level confidence control on every scored step. Calibration is a first-class instrument (B6).                                                  | Butterfield and Metcalfe 2001, JEP:LMC 27(6) [V]; Richland, Kornell and Kao 2009, JEP:Applied 15(3) [V]                                                        |
| 11  | Hold first-try success near 80 to 85%                    | Too easy gives no signal and too hard gives noise. This paper models gradient-descent learners, so treat it as a heuristic, not a law.                                                     | Elo-style item selection aims for a predicted success of 0.70 to 0.90.                                                                                | Wilson, Shenhav, Straccia and Cohen 2019, Nat. Commun. 10, 4646 [V]; Pelanek 2016, Computers and Education 98 [M]                                              |
| 12  | Coherence: no seductive details, no split attention      | Interesting but irrelevant material costs learning. Integrated text and graphic gives g = 0.63.                                                                                            | An example is the problem statement and never decoration. Labels sit on the diagram. On mobile, code and question share one viewport.                 | Sundararajan and Adesope 2020, Educ. Psych. Rev. 32 [V]; Schroeder and Cenkci 2018, Educ. Psych. Rev. 30 [V]                                                   |
| 13  | Rewards inform and never control                         | Engagement-contingent rewards undermine intrinsic motivation (d = -0.40). Positive informational feedback raises it (d = +0.33). Leaderboards and badges lowered motivation over 16 weeks. | XP only for demonstrated retrieval or skill. No leaderboards, no points for opening the app, no badges for trivia.                                    | Deci, Koestner and Ryan 1999, Psych. Bull. 125(6) [V]; Hanus and Fox 2015, Computers and Education 80 [V]; Sailer and Homner 2020 [V]; Li, Hew and Du 2024 [V] |
| 14  | Goals with slack, not streaks                            | Explicit emergency reserves increase persistence after a lapse.                                                                                                                            | A weekly goal plus banked rest weeks. No loss-framed notifications.                                                                                   | Sharif and Shu 2017, J. Marketing Res. 54(3) [V]                                                                                                               |

**Umbrella.** Bjork and Bjork 2011, "Making things hard on yourself, but in a good way" (in
_Psychology and the Real World_) [M]. It is the one-page rationale in lesson 0.1.

**What not to do**, from the same table: streak anxiety, leaderboards, points for trivial
actions, the illusion of competence from rereading, split attention, seductive details.

## B. Core loop

### B1. First session (8 minutes, no quiz)

1. **One question:** "New to code / I build with AI / Experienced". This sets only the
   starting rung.
2. **Reading ladder.** The learner gets 8 to 10 short, realistic snippets, one per rung, in
   varied settings.
   - The rungs run HTML, CSS, JS closure, async order, React render, SQL join, a
     check-then-act race.
   - Each asks "what does this print", "which line is wrong" or "what happens when two
     requests arrive at once".
   - It is a staircase: two correct moves up two rungs, one wrong moves down one. It stops at
     three reversals or 10 items.
   - Confidence is captured on every item.
3. **Output.** The ladder sets a starting rating theta per module band. Concepts below the
   final rung are marked **assumed**, which the map shows as outlined and not filled.
4. **Nothing is locked.** Assumed concepts are verified by probes mixed into the first two
   weeks of practice, so placement continues quietly. A wrong probe flips the concept to "gap".
5. **Ending.** The first screen after placement is the map with three marked entry points.
   Then the learner chooses a weekly goal, and the session is over.

### B2. Returning, 10 minutes, phone

- The length is chosen first: 5, 10 or 20 minutes. A 10-minute session holds about 14 items.
- **Composition:**
  - 60% due FSRS items, sorted by lowest R first.
  - 25% interleaved exercise templates for the two weakest concepts. These are read, trace and
    arrange formats only, with no typing of code on the phone.
  - 15% one probe, or one Signal-spawned card.
- **Phone step types:** predict-output, trace table, multiple-choice, token bank, Parsons,
  bug-hunt (tap the line), ai-review (tap the flaw and pick the reason), recall, and
  explain-back by voice or text.
- **Closing screen:** items strengthened, one calibration line, next due date, and "Done".
- **Practice by topic.** The learner may choose topics for today (the profile interests,
  `src/core/profile`), whether or not the lessons are done. The session then holds, within
  those topics only: due items, lowest R first, up to the 60% due share; then first looks at
  lessons not taken yet, interleaved across the chosen topics; then more due items; then
  mixed practice of lessons already done. A first look is a recall card or a step that stands
  on its own (multiple-choice, predict-output, fill-blank, Parsons, bug-hunt), never one
  already seen. Each topic starts at its earliest untaken lesson, with that lesson's easiest
  step and a recall card, so one session touches several lessons. Every first look shows its
  answer and feedback, so a wrong guess still teaches: a failed attempt before the lesson
  improves learning of the answer once it is given (the pretesting effect; Richland, Kornell
  and Kao 2009 [V]). With no topics chosen, the session is the composition above.
  `buildSession({ topics })`, source `first-look`.

### B3. 45 minutes, desktop

| Time     | What happens                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| 0 to 8   | Warm-up retrieval, which is the same queue as the phone session.                                                     |
| 8 to 35  | One lesson in the module's mode, including its lab and one typed code-challenge or bug-hunt in the unplugged editor. |
| 35 to 42 | Explain-back on the lesson's core idea, then a rubric self-grade.                                                    |
| 42 to 45 | New cards are previewed once and the session closes. Why the next chapter matters is shown as one sentence.          |

### B4. Mastery model

Each concept `c` owns two kinds of FSRS item: fact cards, and **skill items**, which are
exercise templates with parameter variants. Both run on the same scheduler.

- **FSRS-4.5/5 forgetting curve:** `R(t) = (1 + (19/81) * t/S)^(-0.5)`, which gives R = 0.9 at
  t = S. Use `ts-fsrs`. Check the constants against the open-spaced-repetition wiki [M].
- **Memory:** `M_c` is the mean R(now) over the concept's items.
- **Attempt score `s`:**
  - 1.0 for first try with no hint.
  - 0.6 for second try.
  - `max(0.2, 1 - 0.2 * hints)` when hints were used.
  - 0 when the solution was revealed.
- **Skill:** `P_c <- (1 - alpha) * P_c + alpha * s`, with P starting at 0. alpha is 0.15 for
  recognise formats (MC, predict), 0.25 for arrange and fix (Parsons, bug-hunt, ai-review), and
  0.35 for produce and explain (code-challenge, playground or sql step with checks,
  explain-back).
- **Raw mastery:** `raw = 0.4 * M_c + 0.6 * P_c`.
- **Evidence caps:** mastery is capped at 0.6 until two format families have passed, and at 0.8
  until a produce or explain item has passed.
- **Mastery:** `mastery_c = min(raw, cap)`.

| State      | Rule                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Unseen     | No evidence yet.                                                                                                   |
| Assumed    | Set by placement only.                                                                                             |
| Introduced | Mastery below 0.4.                                                                                                 |
| Practised  | 0.4 to 0.7.                                                                                                        |
| Solid      | 0.7 to 0.85.                                                                                                       |
| Fluent     | At least 0.85, mean stability S at least 21 days, and successes on at least 2 distinct days at least 7 days apart. |
| Gap        | The concept was Solid or Fluent and has fallen below 0.6.                                                          |

Because M decays, the map fades without any extra logic. That decay makes gaps visible, which
is what the product promises: know what is underneath.

**Testable.**

- Unit-test every formula above.
- For model validity, log the predicted success probability before each attempt and report
  Brier score and a reliability plot locally. The target is a Brier score below 0.20 after 200
  attempts.
- If it misses, tune alpha and the 0.4/0.6 weights.

### B5. Difficulty and mode

- **Difficulty**
  - Authors seed each item `d` in 1..5, and the item rating is `b = 800 + 200 * d`.
  - The learner has a rating theta per module, starting from placement.
  - Predicted success is `p = 1 / (1 + 10^((b - theta) / 400))`.
  - After each attempt, `theta += 24 * (s - p)`. Item ratings stay fixed because there is no
    backend to calibrate a population.
  - The selector prefers items with p in 0.70 to 0.90. If a session's running first-try rate
    goes above 0.9 it raises the target band by one step, and below 0.65 it lowers it.
- **Mode choice (per module)**
  - Challenge-first if the mean mastery of the module's prerequisite concepts is at least 0.7,
    or p on the module's opening problem is at least 0.5. Otherwise Guided.
  - Ties go to Guided, because of the asymmetry in Tetzlaff et al.
  - The learner can always override.
- **Guided fading**
  - Lesson k of a concept group shows a full worked example with one self-explanation prompt.
  - The next lesson blanks the last step, then the last two, then gives the full problem
    (backward fading, Renkl and Atkinson).
  - A blank is filled only after the learner attempts it.
- **Promotion**
  - Two consecutive lessons with first-try at least 85% and zero hints trigger one line: "9 of
    10 without hints. Switch this module to Challenge-first?"
- **Demotion**
  - Two consolidation checks below 50% trigger an offer of Guided.
  - A failed attempt in Challenge-first is never penalised. The attempt earns the XP for effort
    shown, as defined in C.
- **Challenge-first time box**
  - 8 minutes on desktop and 3 on phone.
  - Consolidation always follows, whether or not the attempt succeeded.
- **Test-out**
  - Each module has a 20-minute, 6-task boss set with at least one produce task and one review
    task.
  - Passing at 80% or more marks the module's concepts Practised, with P = 0.7.
  - Their FSRS items enter at S = 7 days, so the claim still gets verified over time.

**Unplugged as features**

1. The editor has no AI and suggests no code. The label reads "Unplugged". On a phone a
   row finishes words the learner started, from keywords and the words already in the
   file, and nothing else: typing help, not recall help (docs/MOBILE-EDITING.md).
2. An ai-review step appears in every lesson from Module 3 onward. It shows plausible
   AI-written code with exactly one seeded flaw, and the flaw classes rotate through logic,
   race, security, a hallucinated API, and an unhandled edge.
3. Lesson 0.7 teaches the generation-then-comprehension protocol and reuses it throughout:
   state what the code must do, read it, predict a test, and only then run it.
4. Trace tables are a first-class step type.
5. Settings hold a plain weekly self-report: "Hours coded with AI / without". It is shown next
   to calibration. No judgement is attached, because the data is for the learner.

### B6. Novel mechanics

1. **Comprehension coverage**
   - This is like test coverage, but for your understanding of your own repo.
   - The learner drops in a folder using the File System Access API. The fallbacks are
     `<input webkitdirectory>` and paste.
   - Code is parsed in a Web Worker with the TypeScript compiler API and never leaves the
     device.
   - About 120 rule-based detectors map AST patterns to concepts.
     - `await` inside a `for` loop maps to sequential versus parallel.
     - A read followed by a write with no transaction maps to check-then-act.
     - `useEffect` with a missing dependency maps to effects.
   - The output is a file tree and gutter coloured by concept state, plus one line such as
     "This file uses 14 concepts. 5 are gaps."
   - It also generates exercises from the learner's own code: identifier cloze, a Parsons
     problem from a real function, and an explain-back on a chosen function with
     detector-driven prompts.
   - No shipped learning app known to the planner does this, and it serves the goal of
     understanding the code you already ship.
2. **Calibration as the headline instrument**
   - The main dial shows, per module, the gap between stated confidence and actual accuracy. It
     does not show XP.
   - "Certain" answers that were wrong get a fast-track re-test within the same session, which
     is the hypercorrection effect.
   - It answers the AI-era problem found in Perry et al.: confidence that outruns competence.
   - It is pure arithmetic and easy to unit-test.
3. **Incident desk**
   - Deterministic in-browser simulators replay production incidents on small, realistic
     systems, using a seeded scheduler over the real lab engines.
   - Examples: "402 orders accepted, 400 in stock", "webhook delivered twice, two emails, one
     charge", "cron ran on two instances", "p99 tripled after deploy".
   - The learner reads logs and code, names the cause, picks the fix, and writes a five-line
     postmortem.
   - Incidents enter practice sessions at irregular intervals with a fixed reward. The
     variation is in the challenge, not in the reward.

**Feasibility without a backend**

- Progress lives in IndexedDB with JSON export and import.
- JS and TS run in a sandboxed Worker. HTML and CSS run in a sandboxed iframe.
- SQL runs on PGlite (Postgres compiled to WASM). PGlite is effectively single-connection, so
  the isolation and locking labs must be purpose-built simulators. They cannot be real
  concurrent sessions.
- Signal ships as static JSON, built by a scheduled CI job.

## C. Gamification

There are two ladders only. XP measures effort this week, and rank measures proven competence.
There are no levels.

### XP

| Step                                    | Base XP |
| --------------------------------------- | ------- |
| recall card                             | 2       |
| predict / MC / fill-blank               | 4       |
| parsons / trace                         | 6       |
| lab checkpoint                          | 8       |
| bug-hunt / ai-review / explain-back     | 10      |
| code-challenge, checked playground, sql | 15      |
| incident                                | 25      |
| test-out passed                         | 60      |
| timed coding test, per task             | 20      |
| capstone                                | 100     |
| prose, opening the app, confidence taps | 0       |

- **Formula:** `xp = round(base * s * spacingBonus)`.
- **Spacing bonus:** `spacingBonus = min(1.5, 1 + (1 - R))`, using R at the moment of review.
  This pays more for recalling something nearly forgotten.
- **No cramming:** an item with R above 0.95 that was not scheduled earns 0.
- **No grinding:** repeating the same item within 24 hours earns 0.
- **Challenge-first attempts:** an attempt with any submitted approach earns 0.5 * base even
  when wrong. This is effort feedback, not reward for being correct.
- **Explain-back:** the rubric self-grade maps 0 to 3 to s of 0, 0.4, 0.7 and 1.
- **Anti-inflation check:** 1 in 5 explain-backs is followed by a scored transfer question. If
  the transfer result disagrees with the self-grade three times running, show "Your self-grades
  run high."
- **Timed coding tests:** each task earns 20 times the test's score (0 to 1). The same test
  sat again within 24 hours earns nothing. Tests sit inside the path stages as optional,
  recommended work, and this is their reward.
- XP is derived from events and never stored, so a sync merge cannot double-award.

### Weekly goal

- The week is the ISO week in the learner's local time.
- The tiers are Light 150, Steady 300 and Deep 600, and the tier can be changed at any time.
- A **run** is the count of consecutive weeks in which the goal was met.
- **Rest weeks:** the learner starts with 1, earns 1 for every 4 met weeks, and can hold at
  most 2. One is spent automatically on a missed week (Sharif and Shu).
- When a week is missed with none left, the copy reads: "Run ended at 7 weeks. Best 7."
- **Notifications** are opt-in, at most one a day, and only when items are due. None use loss
  framing.

### Ranks

Ranks are named after the skill progression in principle 6, never demote, and are computed
purely from mastery.

| Rank      | Requirement                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Reader    | Placement done.                                                                                        |
| Tracer    | 25 concepts Solid.                                                                                     |
| Builder   | 60 Solid and 3 capstones.                                                                              |
| Reviewer  | 100 Solid, 15 ai-reviews passed, and a calibration gap of at most 15 points over the last 100 answers. |
| Engineer  | 160 Solid and 5 capstones.                                                                             |
| Architect | 220 Solid, all capstones, 8 incidents and 10 Fluent concepts in each of Modules 10, 14, 15 and 16.     |

Treat these Solid counts as provisional. Set the final counts once the concept list exists,
because Architect must not ask for more concepts than the course contains.

A capstone closes each part (see "Parts and milestones"), so the course has seven. Engineer
asks for 5, the capstones up to and including Production, and Architect for all 7. Before
parts there was one capstone per module and Engineer asked for 10.

### Mastery map

- The map is a typeset index (module, then concept), not a node graph.
- State is encoded with the three allowed weights and one accent colour:

| State     | Encoding                         |
| --------- | -------------------------------- |
| Unseen    | Light weight, muted.             |
| Assumed   | Regular weight, outlined marker. |
| Practised | Regular weight.                  |
| Solid     | Medium weight.                   |
| Fluent    | Bold.                            |
| Gap       | The accent colour.               |

- The accent colour is used for gaps and the primary action, and nowhere else.
- The mono column on the right shows R in per cent and the next due date.
- There is a second view: the same data as an 8 pt grid heatmap per module.
- The map is the Mastery section of the Progress page (`/progress#mastery`), scoped like the
  rest of that page to everything, the learner's path, an interest or a part.

### Collectibles that are knowledge

- **Bibliography.** A primary reading enters the personal bibliography once its three recall
  cards pass at an interval of 7 days or more.
- **ADR log.** Built. One architecture decision record per capstone, offered under the
  capstone once it is marked built and never required for it. The shape is Nygard's
  ("Documenting Architecture Decisions", Cognitect, 2011: title, context, decision, status,
  consequences) with MADR's considered options (adr.github.io/madr) as "Alternatives
  considered". Title and decision are required, the other sections optional. Status is
  always Accepted: the record describes what was built. Saving records
  `capstone_adr_written` with the part id; an edit is a newer event and the latest one per
  part wins, so every version stays in the log. The record earns no XP: writing about a
  project is reflection, and XP stays tied to shown skill. The log at `/decisions`, reached
  from Settings and from each record, lists the records in part order, numbered by the part
  (`ADR 0003` is part 3's, whenever it was written), and exports them as one Markdown file
  or one file each (`adr-0003-<part>.md`, as adr-tools names them). The milestone file
  carries the part's record under its capstone.
- **Postmortems.** One per incident.

All three export as Markdown, which makes them a portfolio artefact for the learner too.

### SDT mapping

| Need                           | How it is met                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Autonomy                       | Nothing is locked. The learner can override mode, pick any goal tier and session length, and test out.            |
| Competence                     | The map, calibration, and honest decay.                                                                           |
| Relatedness, without a backend | The content repo is open. Accepted errata are credited in the lesson colophon.                                    |
|                                | A "same set" share link encodes a seed, so two people do the same session and compare afterwards with no ranking. |
|                                | Authors and the people behind each paper are named.                                                               |

### Ethical "can't stop"

- Sessions are finite and sized in advance.
- The closing screen's primary action is "Done". There is no auto-advance.
- An empty queue reads "Nothing due. Next: Thursday, 12 items."
- The pull to return comes from the next chapter's open problem and from visible decay, never from a
  threatened loss.

### Parts and milestones

The 28 chapters are grouped into seven parts: First code, JavaScript and TypeScript,
Interfaces, Servers and data, Production, Python and AI engineering, and Senior engineer
(`content/course/course.yaml`, listed in `docs/CURRICULUM.md`). Each part ends with a
checkpoint, a capstone and a milestone screen.

| Mechanism                                                                     | Why                                                                                                                                                                                                                       | Source                                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A part is a proximal goal: 20 to 70 lessons with a visible end.               | Children given near subgoals mastered more, judged themselves more capable and chose the activity more often than those given only a distant goal. Goals work best when they are specific, near and fed back on progress. | Bandura and Schunk 1981, JPSP 41(3), 586 to 598 [V]; Locke and Latham 2002, American Psychologist 57(9), 705 to 717 [V] |
| Each part has its own progress line, and Learn shows no course-wide bar.      | Effort rises as a goal gets closer (the goal-gradient effect), and the effect is driven by the proportion left, so a near finish line pulls harder than one 270 lessons away. It is a pull, never a penalty.              | Kivetz, Urminsky and Zheng 2006, Journal of Marketing Research 43(1), 39 to 58 [V]                                      |
| The checkpoint is a cumulative mixed review of the whole part, weakest first. | Mixing problem types across earlier material beat blocked practice on a delayed test by a wide margin. Retrieval over the part, not a re-read, is what the checkpoint asks for.                                           | Rohrer, Dedrick and Stershic 2015, Journal of Educational Psychology 107(3), 900 to 908 [V]; principle 1 and 3 above    |
| The milestone informs: what you can now do, where each concept stands today.  | Rewards that are expected and contingent on doing the task undermine interest; positive, informational feedback raises it. A milestone says what was mastered and never grants points for arriving.                       | Deci, Koestner and Ryan 1999, Psych. Bull. 125(6), 627 to 668 [V]                                                       |
| Nothing is locked: checkpoint, test-out and capstone are open from the start. | Choice raises intrinsic motivation, effort and performance, most when the options are few and meaningful. A part can be tested out of, and the order is advice.                                                           | Patall, Cooper and Robinson 2008, Psych. Bull. 134(2), 270 to 300 [V]                                                   |

Rules, each a pure function in `src/core` with tests:

- **Membership.** A part names modules. A woven module (cs, clean, pro) belongs to no part;
  each of its lessons counts towards the part of the lesson it is woven after, following
  `wovenAfter` chains (`src/core/content/parts.ts`).
- **Progress.** Lessons done of total and concepts Solid or better of total, both as
  fractions. A lesson is done when it was completed, or when its module or its part was
  tested out. A part is complete when every published lesson is done; a part with none is
  never complete. The current part is the first part with lessons that is not complete
  (`src/core/insight/parts.ts`).
- **Checkpoint.** One 10-minute session (14 items) over the part's concepts, built from
  the practice items and selection rules (`buildCheckpoint`). Concepts are ordered by need,
  missing skill (1 - P) plus how far the most forgotten card has faded (1 - R), and taken
  one item per concept per round, due cards first, so the session interleaves the part and
  gives the weakest and most forgotten concepts the most room. It is offered on Today once
  a part is complete and until its concepts are all Solid. It earns XP only through the
  items answered, under the rules above; opening it earns nothing.
- **Test-out.** The same builder at 20 minutes, scored. 80% passes (B5) and is recorded as
  `test_out_attempted` with the part id; every lesson of the part then counts as done.
- **Capstone.** A small project per part, briefed from its modules' "You can build" lines.
  Marking it built records `capstone_completed` with the part id, once, and ranks count it.
  Once built, the learner can write its decision record (see "Collectibles that are
  knowledge").
- **Milestone.** Derived, never stored: a part's milestone is the moment it is complete.
  The screen shows the part summary and its modules' "You can build" lines, the part's
  concepts by state, the capstone, and a Markdown export of the brief, the decision record,
  the concept table and the learner's own explain-back texts. Its one primary action is
  "Done". There is no confetti, no sound, no auto-advance; the only motion is the 240 ms
  step-in, which reduced motion removes.
- **Time.** Every lesson shows its author's estimate. Chapters, parts and the journey show
  the sum, with what is left; a part adds its checkpoint. Sums say "about".

### Learning paths, the final exam and the certificate

A learning path (`content/tracks/<id>.yaml`) is one goal in a few stages. It ends in a final
exam and, once passed, a certificate of completion.

- **Exam.** One 20-minute sitting (28 items, B2's rate), the test-out's length (B5). It is
  built from the scored steps of the path's required lessons only (`buildPathExam` in
  `src/core/exam`). Seats go to the stages in turn, one each per round, until the exam is
  full or a stage has none left, so every stage is examined about equally whatever its size;
  inside a stage the lessons take turns, and the exam alternates between stages, so it reads
  as mixed review (principle 3). Unlike a checkpoint it ignores what the learner finds weak:
  a score that is shown to someone else should not depend on the learner's history, so the
  same seed gives the same exam to everyone. Self-graded steps (explain-back) are left out,
  so every point is checked by the app; a phone leaves out code challenges, as in practice.
- **Pass rule.** 80% or more of the items answered (B5). An item skipped because its content
  changed counts neither way. There is no lock: the exam is open from the start and can be
  sat as often as wanted (Patall, Cooper and Robinson 2008, above); the intro says it works
  best after the lessons.
- **Facts and derivations.** Each sitting records `path_exam_attempted` with the path id,
  the seed, right, total, start and finish times and the lesson ids it covered. Attempts,
  the best score (highest share, earliest on a tie), passed and the first passing attempt
  are derived (`pathExamResult`), never stored. The exam earns no XP of its own; its items
  earn theirs as `step_answered` events, like a test-out's.
- **Result.** The score and the verdict, then each stage with its share. A stage under 80%
  is weak and lists the lessons behind its misses. The feedback is informational, not a
  reward (Deci, Koestner and Ryan 1999, above).
- **Certificate.** Issued from the first passing attempt, so its date, score and code never
  change after. The verification code is FNV-1a over the path id, the date, the score and
  the sorted lesson ids: a check that the printed facts belong together, not security. The
  certificate says it is not an accredited qualification.

### Unit-test list

- `xpFor(step, s, R, lastSeenAt)`
- `weekKey(date, tz)`
- `applyWeek(state, xp)`, covering run, reserve spend and reserve earn
- `rankFor(masteryStates, capstones, calibration)`
- `calibrationGap(answers)`
- `selectSession(items, minutes, device)`, which must be deterministic given a seed
- `modeFor(module, mastery, theta)`
- `masteryFor(concept)`

## D. Plans

A plan turns "what do you want?" into a sequence the learner can follow without deciding
every day. The code is `src/core/plan/`, the screens `src/features/plan/` at `/plan`.

- **Three answers, one fact.** Goal (eight: learn from zero, refresh fundamentals, a second
  language, build products, AI engineering, interviews, senior rounds, stay sharp), time (a
  weekly budget and, optionally, a date) and starting point (level and main language). They
  are one `plan_set` event; `plan_cleared` drops the plan. Nothing else about a plan is
  stored.
- **Phases with a reason and a milestone.** Each goal is a sequence of phases built from the
  paths, the course parts and the simulator's tests. Each phase says why it comes now and ends
  in a milestone: a path exam, a part checkpoint or a timed test at a target score. A lesson
  appears once, in the first phase that asks for it. Levels skip what a learner already knows.
- **Deadlines trim by priority.** With a date, phases are kept by priority until the days run
  out; the rest wait under "if time allows". Interview prep keeps the routine and timed
  practice first, because a candidate who knows the format and has rehearsed it gains most in
  a few days.
- **Today, and pace.** The next step is the first unfinished item of the counted phases.
  Pace compares the minutes done with the share of the calendar gone, with a day's slack
  either side, so one quiet day does not read as failure.
- **Derived, so it follows the content.** Progress counts completed lessons, best test scores
  and passed exams. When the catalogue changes, the plan changes with it; the answers stay.

## Sources

- [How AI Impacts Skill Formation (arXiv 2601.20245)](https://arxiv.org/abs/2601.20245)
- [How AI assistance impacts the formation of coding skills, Anthropic](https://www.anthropic.com/research/AI-assistance-coding-skills)
- [Sinha and Kapur 2021, Review of Educational Research](https://journals.sagepub.com/doi/10.3102/00346543211019105)
- [Tetzlaff et al. 2025, Learning and Instruction](https://www.sciencedirect.com/science/article/pii/S0959475225000660)
- [Morrison et al. 2016, SIGCSE](https://dl.acm.org/doi/10.1145/2839509.2844617)
- [Ericson, Foley and Rick 2018, ICER](https://www.researchgate.net/publication/326918129_Evaluating_the_Efficiency_and_Effectiveness_of_Adaptive_Parsons_Problems)
- [Sailer and Homner 2020, Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- [Li, Hew and Du 2024, ETR&D](https://link.springer.com/article/10.1007/s11423-023-10337-7)
- [Brunmair and Richter 2019, Psychological Bulletin](https://psycnet.apa.org/record/2019-57442-001)
- [Bisra et al. 2018, Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-018-9434-x)
- [Hanus and Fox 2015, Computers and Education](https://www.semanticscholar.org/paper/Assessing-the-effects-of-gamification-in-the-A-on-Hanus-Fox/dff76a9862467d426113ec530f83942016ae3a97)
- [Sundararajan and Adesope 2020, Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-020-09522-4)
- [Wilson et al. 2019, Nature Communications](https://www.nature.com/articles/s41467-019-12552-4)
- [Ye, Su and Cao 2022, KDD](https://dl.acm.org/doi/10.1145/3534678.3539081)
- [Lopez et al. 2008, ICER](https://dl.acm.org/doi/10.1145/1404520.1404531)
- [Schroeder and Cenkci 2018, Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-018-9435-9)
- [Adesope, Trevisan and Sundararajan 2017, Review of Educational Research](https://journals.sagepub.com/doi/abs/10.3102/0034654316689306)
- [Cepeda et al. 2006, Psychological Bulletin](https://www.yorku.ca/ncepeda/publications/CPVWR2006.html)
- [Sentance, Waite and Kallia 2019, Computer Science Education](https://www.tandfonline.com/doi/full/10.1080/08993408.2019.1608781)
- [Sharif and Shu 2017, Journal of Marketing Research](https://journals.sagepub.com/doi/10.1509/jmr.15.0231)
- [Deci, Koestner and Ryan 1999, Psychological Bulletin](https://www.semanticscholar.org/paper/A-meta-analytic-review-of-experiments-examining-the-Deci-Koestner/8ad9801baea65b40fbbe6fc56e34b2b7be47d0ba)
- [Butterfield and Metcalfe 2001, JEP:LMC](https://pubmed.ncbi.nlm.nih.gov/11713883/)
- [Renkl and Atkinson 2003, Educational Psychologist](https://www.tandfonline.com/doi/abs/10.1207/S15326985EP3801_3)
- [Xie et al. 2019, Computer Science Education](https://eric.ed.gov/?id=EJ1218026)
- [Perry et al. 2023, CCS](https://dl.acm.org/doi/10.1145/3576915.3623157)
- [Karpicke, Butler and Roediger 2009, Memory](https://www.tandfonline.com/doi/abs/10.1080/09658210802647009)
- [Helland 2012, ACM Queue](https://queue.acm.org/detail.cfm?id=2187821)
- [Nygard 2011, Documenting Architecture Decisions](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [MADR, Markdown Architectural Decision Records](https://adr.github.io/madr/)
- [Richland, Kornell and Kao 2009, JEP:Applied](https://pubmed.ncbi.nlm.nih.gov/19751074/)
- [Kornell and Bjork 2008, Psychological Science](https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2008.02127.x)
- [ts-fsrs, open-spaced-repetition](https://github.com/open-spaced-repetition/ts-fsrs)
- [Bandura and Schunk 1981, Journal of Personality and Social Psychology](https://doi.org/10.1037/0022-3514.41.3.586)
- [Locke and Latham 2002, American Psychologist](https://doi.org/10.1037/0003-066X.57.9.705)
- [Kivetz, Urminsky and Zheng 2006, Journal of Marketing Research](https://doi.org/10.1509/jmkr.43.1.39)
- [Rohrer, Dedrick and Stershic 2015, Journal of Educational Psychology](https://doi.org/10.1037/edu0000001)
- [Patall, Cooper and Robinson 2008, Psychological Bulletin](https://doi.org/10.1037/0033-2909.134.2.270)

## Implementation notes (M2)

Recorded during the milestone 2 build (`src/core/progress`, `mastery`, `gamification`,
`scheduling`, `practice`, `grading`, `placement`), where the spec above was ambiguous. Each
entry is the simplest reading chosen, not a change to the rule itself.

- **Attempt score beyond the second try.** B4 gives 1.0 for the first try and 0.6 for the
  second, but does not define a third bucket for an unhinted, unrevealed later try. `0.6` is
  reused for any try number above 1 that is not hinted or revealed.
- **A final wrong, unrevealed answer.** Scores 0: no correct answer was ever produced, so
  there is nothing to reward.
- **FSRS short-term learning steps are disabled** (`enable_short_term: false`). This app
  reviews on a day-level cadence (`localDate`, whole-day `elapsedDays`), not Anki's
  minute-scale learning steps; enabling them made a card's very next review land minutes
  later instead of days, which does not fit the product's daily queue.
- **`ratingFromScore`.** The doc defines `s` (attempt score) and separately says
  `review_graded` carries an FSRS `rating`, but never gives the mapping between them. The
  chosen mapping: `s = 0` to Again, `0 < s < 0.6` to Hard, `0.6 <= s < 1` to Good, `s = 1` to
  Easy (or Good if the learner's stated confidence was "guess", since a guessed-but-correct
  answer is not the same evidence as a confident one).
- **XP source per event type.** Skill items (FSRS `cardKey` starting `skill:`) can produce
  both a `step_answered` and a `review_graded` event for the same physical attempt. To avoid
  double-awarding XP, only `step_answered` earns XP for skill items; the paired
  `review_graded` event is scheduling-only. Recall (fact) cards (`cardKey` starting
  `lesson:`) have no paired `step_answered`, so `review_graded` is their only XP source.
  Their attempt score is derived from the FSRS rating via the same four-point scale as the
  explain-back self-grade (`scoreFromRating`: Again/Hard/Good/Easy -> 0, 0.4, 0.7, 1), since
  the doc does not define a separate scale for a flashcard flip.
- **Spacing bonus scope.** The R-based spacing bonus, the no-cramming rule and the
  "unscheduled" check apply only where R is meaningful: recall-card reviews. Lesson and
  practice step attempts (`step_answered`) use a spacing bonus of 1 (R not tracked per step)
  and are always treated as "scheduled"; only the 24-hour no-grinding rule applies to them.
- **`session_finished.items`.** Modelled as a count, not a list of item results, since each
  item's facts already exist as their own events (`step_answered`, `review_graded`, and so
  on) and repeating them here would risk drift.
- **Test-out's P = 0.7 / S = 7 days rule.** The reducer does not know a module's concept
  list (that lives in content, outside `src/core/progress`), so it cannot apply this rule to
  specific concepts by itself. It records the raw `test_out_attempted` facts (score, passed,
  timestamp) per module; a caller that does hold the catalog (for example the practice
  session builder) is expected to apply `mastery.TEST_OUT_PASS_SKILL_P` and
  `mastery.TEST_OUT_INITIAL_STABILITY_DAYS` to that module's concepts when a pass is present.
- **Rung-to-theta mapping.** B5 defines theta only through placement and the Elo update; B1
  does not give a formula from a ladder rung to a starting theta. `thetaForBand` keeps theta
  on the item scale (`800 + 200 * d`, d 1 to 5): a module whose band is the final rung starts
  at d 3, each rung below the final rung adds a step and each rung above takes one away,
  clamped to the scale. A module in two bands is rated by the higher one. Concepts on rungs
  below the final rung are assumed, except a concept the learner answered wrong and never
  right. The opening question sets the start: new at rung 1, builds with AI at rung 3,
  experienced at rung 5. A rung with no unseen item left ends the ladder, and a later attempt
  rotates which item each rung shows first.
- **Target band shift step.** B5 names the trigger thresholds (running first-try rate above
  0.9 or below 0.65) but not how far the 0.70-0.90 target band moves. A step of 0.1 is used,
  clamped to `[0, 1]`.
- **Session size.** B2 gives one data point ("a 10-minute session holds about 14 items").
  `ITEMS_PER_MINUTE = 1.4` is the simplest constant rate consistent with it.
- **`buildSession`'s return shape.** Returns `{ items, nextDueDate }` rather than a bare
  array, so "Nothing due" can carry the next due date the closing screen needs, as the
  deliverable brief itself asks for.
- **Weakest-concept selection for interleaving.** "The two weakest concepts" is read as: the
  single weakest concept with an available skill item, plus its confusable partner if the
  catalog defines one (preferring confusable pairs per principle 3); otherwise the second
  weakest concept.
- **Explain-back "passed".** Counts as a produce/explain pass (B4's evidence cap, and the
  concept's family-passed set) only at the full rubric score (`rubricHits === 3`), matching
  `gradeStep`'s definition of "correct" for the same step type.
- **Parsons grading.** A used distractor or a wrong indentation both cap the score at the
  bug-hunt/ai-review "right line, wrong reason" constant (0.5), rather than introducing a
  second partial-credit number the doc does not define.
