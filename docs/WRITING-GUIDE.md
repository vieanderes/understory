# Writing guide

How Understory lessons sound. This guide replaces the voice rules in
`docs/CONTENT-GUIDE.md` and `docs/AUTHOR-BRIEF.md` wherever they disagree.

## Why this exists

Early readers found the first lessons hard, dry, and in need of several readings. The
numbers did not explain it: the median sentence has 11.5 words and a Flesch reading ease of
82, which counts as easy. The text was hard for other reasons, and they are fixable:

| Problem found            | Where it showed                                                                   | Why it hurts                                           |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| No reason to care        | Openings were puzzles, not promises                                               | Nothing motivates the effort of the first step         |
| Decoding before thinking | A table of "group A" and "group B" plans had to be read before the idea           | The scenario cost more working memory than the concept |
| Double questions         | "Which feels readier on Monday, and which scores higher on Saturday?"             | Two answers must be held at once                       |
| Long, look-alike choices | Four compound sentences that differ in two words                                  | Comparing wording, not thinking about the idea         |
| Robotic feedback         | "You predicted that ... In fact ... because ..." up to 15 times per lesson        | Reads as a machine; 26 words each time                 |
| Research in the body     | Author names, years, "272 comparisons" inside explanations                        | Interrupts the idea; belongs in Read next              |
| Formal register          | No contractions, no warmth, a style guide that banned jokes and exclamation marks | Conversational text teaches better (below)             |
| Prose in the code pane   | Plain sentences set in a monospace block                                          | Slower to read, looks like code to decode              |

## The evidence

| Finding                                                                                                                                                              | Source                                                                                  | What it means here                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Conversational style ("you", "we", the author's voice visible) improves retention, d = 0.30, and transfer, d = 0.54. The effect shrinks in sessions over 35 minutes. | Ginns, Martin and Marsh (2013), Educational Psychology Review 25(4)                     | Write like a person talking to one learner. Keep lessons short.                          |
| Learner-paced segments improve transfer, d = 0.45, and reduce cognitive load.                                                                                        | Rey et al. (2019), Educational Psychology Review                                        | One idea per screen. The learner controls when the next arrives.                         |
| Average sentence length of 8 words gives full comprehension, 14 words about 90%, 25 words is difficult, 43 words under 10%.                                          | American Press Institute readability research, as summarised in plain-language guidance | Aim for 8 to 14 words. Treat 20 as a hard ceiling.                                       |
| People read about 20 to 28% of the words on a page and scan the rest; 79% scan new pages.                                                                            | Nielsen Norman Group, "How Users Read on the Web" and "How Little Do Users Read?"       | Put the point first. Make the key term findable. Cut the rest.                           |
| Curiosity comes from a small, noticed gap between what you know and want to know. A gap that is too large does not create curiosity.                                 | Loewenstein (1994), Psychological Bulletin 116(1)                                       | Open with a question the learner almost can answer, not a puzzle about a setting.        |
| Interesting but irrelevant detail lowers learning.                                                                                                                   | Sundararajan and Adesope (2020), Educational Psychology Review                          | Warmth yes, decoration no. A scenario earns its place only if it makes the idea clearer. |
| Positive emotional design raises enjoyment; its effect on learning depends on task difficulty.                                                                       | Brom, Stárková and D'Mello (2018), Educational Research Review 25                       | Friendliness keeps people going; it does not replace clarity.                            |

## Rules

### The first screen

1. The opening says what the learner will be able to do and why they would want to, in
   two short sentences, in plain words. Example: "You'll know why rereading your notes
   feels productive but isn't, and what to do instead. It changes how you'll use this
   app."
2. The first scored step is an easy win, difficulty 1, answerable in under 20 seconds.
   Start with competence, then raise the challenge.

### One idea per screen

3. A prose step makes one point. Aim for 30 to 50 words, never more than 70.
4. A step asks one question. Never "and which". At most 20 words.
5. Name the idea after showing it: example first, term second. "Pulling an answer out of
   memory has a name: retrieval practice."
6. Bold a key term the first time it appears (`**retrieval practice**`). Once per step.

### Sentences

7. Aim for 8 to 14 words. Vary the length. Never more than 20.
8. Say it the way you'd explain it to a friend at a desk. Read it aloud; if you wouldn't
   say it, rewrite it.
9. Contractions are welcome: you'll, it's, doesn't. Use "you" for the learner and "we"
   for Understory.
10. Verbs, not nouns: "you forget it", not "forgetting occurs".
11. Everyday words first. A technical term appears only when the lesson teaches it.

### Scenarios and code

12. Use a setting anyone can picture in a second: a to-do list, a shopping cart, a chat,
    a bank transfer. One sentence of setup at most. Vary settings across lessons. No
    recurring product, and nothing from a real person's or company's projects.
13. The code pane holds code, terminal output or data, never sentences. A study plan is
    a short list in the question, not a code block.
14. Every example exists to make the idea visible. If removing the setting makes the step
    clearer, remove it.

### Choices and feedback

15. Three or four choices, each at most 10 words, parallel in form. No "both" or "all of
    the above". The distractors are real mistakes people make.
16. Feedback for the right answer: at most 15 words, says why it's right, adds nothing
    new to memorise.
17. Feedback for a wrong answer: at most 25 words. Name what they probably thought, then
    the one reason it doesn't hold. Vary how you say it. The phrase "You predicted that"
    appears at most twice in a lesson.
18. Be kind about wrong answers. A wrong prediction is the point of predicting: say so
    now and then ("Most people pick this.").

### Research

19. No author names, years or study sizes in steps. At most one line per lesson may say
    that research backs a claim ("This is one of the best-tested findings in learning
    science."). The details live in Read next and the deep dive.

### Tone

20. Warm, direct, a little playful when it helps. Light humour is allowed if it makes the
    idea stick; never a joke that needs explaining.
21. One exclamation mark per lesson at most, in lesson text only. Interface text keeps
    the design laws in `docs/DESIGN.md`: none there.
22. Celebrate real progress briefly ("That's the hard one."), never trivial clicks.

### Shape of a lesson

23. 7 to 10 steps, 10 minutes or less. One big idea. A second big idea is a second lesson.
24. Change the rhythm: a light step after a heavy one. An interaction at least every 45
    seconds of reading.
25. End with a three-line recap of what they can now do, in the lesson's `recap` field. The
    summary screen shows it.

### Building knowledge

These rules exist because the first lessons opened with `require`, file reads and a terminal
prompt, in front of people who had never seen a variable. A newcomer who meets unexplained
syntax on the first screen closes the app.

26. Never use what hasn't been taught. Every keyword, function and symbol in a step was
    introduced in this lesson or an earlier one. If a sample needs something new, teach it
    first or pick a simpler sample.
27. Coding comes first. Tools, theory and how the app works are taught when the learner
    first needs them, never before they have written code.
28. Early code is tiny. A first step shows at most three lines. In the first chapter, samples
    stay under 15 lines, and nothing uses files, modules or the terminal.
29. Learners write code in every beginner lesson, not only read it. Changing one value and
    seeing the result counts.
30. A new term gets a plain definition in the same step, in one sentence. Compare it with
    something everyday when that helps ("a variable is a label on a value").
31. Serve both readers. Steps stay short, so an experienced developer refreshing moves
    fast. Depth goes in the deep dive. Each chapter can be tested out of.

### Explain before you test

A learner went through HTML and the debugging lesson on a phone and learned nothing. The
HTML chapter tested how the parser repairs broken tags before it had said what HTML or the
DOM is for. The debugging lesson asked them to count "frames" on "the stack" that "Node"
prints, and it defined none of those three words. A lesson can pass
every rule above and still teach nothing. These rules close that gap.

32. Build the picture first. Before the first question on a new idea, a prose step says what
    the thing is, what it's for and what it looks like, with a small example. Only then ask
    the learner to predict. A predict step tests a model you gave them. It never replaces
    giving one.
33. Every term is defined where it first appears, every time a lesson could be someone's
    first contact with it. That includes names the author thinks are obvious: Node, the
    browser, the DOM, a parser, a stack, a frame, a request, a server, a runtime. One plain
    sentence, ideally with an everyday comparison ("the call stack is a pile of the
    functions that are still running, newest on top").
34. Teach what a working developer uses. Each step earns its place by passing this test:
    would someone building real software meet this in their first year? Specification
    trivia, edge cases of edge cases and exact internal names (foster parenting, the
    adoption agency algorithm, `Object.<anonymous>`) go in the deep dive, or nowhere.
35. Show why it matters in practice. Every lesson connects to something the learner will do:
    build a page, find a bug, change the text on screen, stop a leak. The opening names that
    payoff, and at least one step makes the learner do it.
36. Go from known to new. Link each new idea to one already taught ("the DOM is a tree of
    objects, like the ones you built in chapter 0"). A lesson that needs a concept from a
    later chapter is in the wrong place.
37. One step, one new thing. A question never introduces a term and tests it at once. If a
    prompt has to define something before asking, that definition belongs in a prose step
    before it.

### Practise coding, not arithmetic

A learner hit a step that printed `45 45`, `45 4545`, `8 45458` and asked which round went
wrong. The feedback was blunt: they wanted to learn to code and to build AI systems, not to
calculate in their head. They also met questions that asked them to use things no lesson had
shown. The course had 624 predict-output steps and 46 trace tables against 102 playgrounds:
far too much tracing values in your head.

38. Every scored step practises a skill a developer uses at work: write code, fix a bug,
    read unfamiliar code for its intent, review code (often written by an AI), choose
    between designs, or explain a decision. Working out values in your head is not one of
    them.
39. No mental arithmetic and no bookkeeping. If an answer needs sums, counting through a
    loop, or holding more than two changing values, replace the step: let the learner run
    it (playground, challenge, sql step) and ask about the cause or the fix instead.
40. Predict steps are for surprises you can answer by understanding, in under 20 seconds
    ("does this code wait for the save?"), never by calculating. At most two per lesson.
    Trace tables only when the table is the mechanism being taught, with at most four rows.
41. At least half the scored steps in a lesson are active: playground, code challenge, bug
    hunt, AI review, sql, parsons or a fill-blank of real code.
42. Make it fun and real. Use situations a developer really meets (a failing deploy, a bug
    report, a pull request to review, an AI suggestion that's subtly wrong, a feature to
    ship), humour where it helps, and a satisfying thing built at the end. From the AI
    chapters on, and wherever it fits earlier, connect the skill to building with AI.
43. Before a question, check the learner has seen every function, keyword, term and tool it
    uses in this lesson or an earlier one (rule 26). A question that needs something new is
    a bug, however obvious the new thing seems.

## Before and after

**Before** (question and one choice, 38 words):

> Each group rates on Monday how ready it feels. Which group feels readier on Monday, and
> which scores higher on Saturday?
> "Group A feels readier on Monday, and group B scores higher on Saturday"

**After** (one question, short choices):

> Two friends have a test on Saturday. Sam rereads the notes four times. Alex reads them
> once, then quizzes themselves. Who remembers more on Saturday?
> Sam · Alex · About the same

**Before** (wrong-answer feedback, 30 words):

> You predicted that the feeling of readiness tracks memory. In fact practice tests beat
> restudy across a meta-analysis of 272 comparisons, because recall strengthens a memory and
> rereading does not.

**After** (18 words):

> It feels that way, doesn't it? Rereading makes notes familiar, and familiar feels like
> known. Recalling is what builds memory.

## Checks

`pnpm content:readability` reports every lesson against the measurable rules: words per
prose step, sentence length, question length and count, choice and feedback length, the
repeated feedback template, research citations in steps, prose in the code pane, more than
two predict-output steps, trace tables over four rows, and lessons where fewer than half the
scored steps are active (rules 40 and 41). The
report is the working list for the rewrite in `docs/ROADMAP.md`. Once the existing lessons
pass, the same rules move into `pnpm validate:content` so no new lesson can slip back.
