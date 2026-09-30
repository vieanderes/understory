# Interview challenge formats

The research behind module 23 (lessons 09 to 16) and module 28 (Interview challenges). It
records what senior full-stack and AI engineering interviews ask candidates to build, and how
each format is scored. Lesson authors read this before writing. Company names stay here and
in lesson references or deep dives, never in steps.

Researched September 2026. Claims marked **unverified** come from candidate reports only.

## 1. The formats

| Format                    | Length           | What is scored                                                  |
| ------------------------- | ---------------- | --------------------------------------------------------------- |
| Timed online test         | 60 to 120 min    | Hidden tests: correctness, and performance on large inputs      |
| Levelled task             | 90 min, 4 levels | Tests per level; a level unlocks when the previous one passes   |
| Live pair coding          | 45 to 60 min     | Communication, problem solving, code, testing                   |
| AI-assisted round         | 60 min           | Same four, plus judgement: planning, verifying, owning the code |
| Take-home                 | 3 to 8 hours     | Working slice, scope, tests, README, defending the decisions    |
| On-site build and present | 4 to 8 hours     | The build, then a 10 to 20 min presentation and questions       |

The trend in 2025 and 2026 is practical, feature-sized problems where later requirements
build on your earlier code, over puzzles.

## 2. Timed online assessments

What a typical assessment platform offers:

- **Screen**. A timed test taken alone. One timer covers every
  task and cannot be paused. When it ends, the editor contents are submitted. Speed does not
  change the automatic score.
- **Live interview**. A live shared editor with video, chat and a whiteboard.
- Two editors. The classic one is a single file with a Run button and a box for your own test
  cases. The newer VS Code environment has multi-file projects, a terminal, a debugger and
  session replay for reviewers, and since mid-2026 a Next.js environment.

Languages (support article updated June 2026):

- Algorithmic tasks: JavaScript on Node 22, TypeScript 5.8 on Node 22, Python 3.12.
- Real-life tasks use a range of older and newer versions (TypeScript from 4.0, React 16.8 to
  18, Express 4 and 5, Jest, PostgreSQL, Django, Flask). Check the version shown in the IDE
  before relying on recent APIs.

Scoring:

- The example in the task statement does not count. Every task has at least six hidden tests.
  The score is the share passed.
- **Correctness** tests use small and medium inputs and corner cases. **Performance** tests
  use large inputs against the expected complexity. Only algorithmic tasks have performance
  tests.
- The report marks each test OK, WRONG ANSWER or TIMEOUT ERROR, and shows a detected time
  complexity. A brute force typically scores full correctness and partial performance.
- Code that does not compile scores 0. A partial solution that compiles beats a perfect one
  that does not.
- Task statements usually give the expected worst-case time complexity. Read it first: it
  names the algorithm.
- Every submission is checked for similarity against known solutions and leaks.

Test shape: employers are advised to use two or three tasks, starting with a warm-up.
Candidate reports describe 90 minutes for two tasks and 100 minutes for three. Pass marks are
set by each employer (unverified figures around 60%).

Task types: algorithmic (correctness plus performance), coding (correctness only),
bug-fixing (change only a few lines; one platform's public example report allows two, and a
submission that changes nothing scores zero), front-end (React, Angular, Vue), back-end
(Express and others), SQL, HTML and CSS, QA (write tests), multiple choice. Newer real-life
tasks are feature-sized: a Kanban board, a tree with cascading checkboxes, a toast queue.

AI-Native tasks (mid-2026) run in VS Code with an assistant:

- **Build AI**: the thing you build is an AI system, for example a RAG pipeline that returns an
  answer and its source chunks, or an anomaly pipeline with a JSON report.
- **Work with AI**: you use an assistant as a co-worker to fix bugs and add a feature.
- Several are designed so that the assistant's most common answer is wrong.
- Scoring stays rule-based. Every prompt and every accepted, edited or rejected suggestion is
  recorded for the reviewer.

The built-in AI assistant (since October 2024) is enabled per test. Employers read the whole
transcript to see whether you "ask reasonable questions" or try to get the whole solution.
Ask narrow questions, check each answer against the spec and your tests.

Integrity signals when proctoring is on: paste events in a timeline, time away from the tab,
unusually fast finishing, webcam snapshots, optional screen recording, ID checks. A paste
does not mean cheating, but it shows. Preview features include typing-pattern analysis and
follow-up questions asking you to explain your solution.

Candidate mechanics:

- Run checks the example plus your own cases. Your cases are not checked against expected
  answers; you see only what your function returns.
- The platform offers a free demo test.
- The live demo (walked through 29 September 2026): intro with a consent box, a skippable
  8-step tour, then "Are you ready to start?". The clock shows `0h 29min`, hours and minutes
  only. One "Submit Assessment" for the whole test. Your own cases go in `test-input.txt`,
  at most 10 lines like `[1, 3, 6]`. The all-pass note promises "at least 8 test cases not
  shown here". The candidate sees correctness, performance and task score per task, not the
  per-test detail. Practise all of this in the AI-assisted coding simulator (docs/ONLINE-TEST.md).
- For 90 minutes and three tasks: read every statement and its complexity line (5 min),
  solve the most familiar task first, submit a brute force on the last one if the fast idea
  does not come, keep five minutes to check.
- Every time, test: the smallest input, the largest, all equal, all negative, duplicates,
  sorted and reverse sorted, and sums or products past 2^53 in JavaScript.
- JavaScript traps: `sort()` without a comparator sorts as strings; `shift()` in a loop is
  O(n²); `includes` in a loop is O(n²); `Math.max(...hugeArray)` overflows the stack;
  recursion 100,000 deep overflows the stack.
- Do not validate what the constraints already rule out.

The platform's public training syllabus: iterations, arrays, time complexity,
counting elements, prefix sums, sorting, stacks and queues, leader, maximum slice, prime and
composite numbers, sieve of Eratosthenes, Euclidean algorithm, Fibonacci numbers, binary
search, caterpillar method, greedy algorithms, dynamic programming. The platform tells employers
not to use training tasks in real tests, so expect the patterns, reskinned.

## 3. Levelled tasks

A levelled-task assessment is one project-style question with four levels in 90
minutes. You are not expected to finish. Level 1 is basic operations and corner cases, level
2 processing (calculations, exports), level 3 advanced features, level 4 an extension that
forces a refactor while earlier levels keep passing.

Reported variants (unverified): an in-memory database (set, get, delete on record, field and
value; scans by prefix; timestamped operations with TTL; backup and restore), a bank system
(accounts, transfers, top spenders, scheduled payments, merging accounts), cloud file
storage with quotas, a credits system with expiry.

The skill it tests: design level 1 so level 4 does not force a rewrite.

## 4. Practical tasks in live rounds

JavaScript and TypeScript utilities: debounce (with cancel, flush, leading and trailing),
throttle, `Promise.all` and `allSettled` from scratch, a concurrency pool, retry with
exponential backoff and jitter, an event emitter with `on`, `off` and `once`, an LRU cache
(a `Map` keeps insertion order), memoise, deep equal, deep clone, flatten, `get(obj, path)`.

Back end: rate limiter (token bucket, sliding window) as middleware; a REST resource with
validation, one error format, pagination and idempotency keys; aggregating a log or CSV;
an in-memory key-value store with transactions (a stack of change sets); an in-memory file
system; a job scheduler with dependencies (topological sort, cycle detection); a crawler that
starts sequential and is then made concurrent and rate limited. A sequential crawler where a
parallel one was expected has been reported as a no-hire.

Front end: autocomplete (debounce, latest request wins or `AbortController`, cache, keyboard
navigation, the ARIA combobox pattern, loading, empty and error states); a data table with
sort, filter and pagination, state in the URL; optimistic updates with rollback; infinite
scroll; a multi-step form; a Kanban board; a tree with cascading checkboxes.

Debug and refactor: tidy 100 lines of nested code, or fix a failing multi-file project.

## 5. AI engineering tasks

From an analysis of over 100 take-home repositories (late 2025 to early 2026): RAG in over
40%, agents and tool calling in over 30%, chatbots over 20%, document extraction 15%,
LLM-as-judge evaluation over 10%. A common spec: a chatbot over documents that cites its
sources and says "I don't have that information" when the context lacks the answer. One
start-up is quoted: "Red flag if candidate doesn't start with evals."

Pieces to be able to write from scratch:

- cosine similarity, dot product (equal to cosine on normalised vectors), top k;
- chunking: fixed size with 10 to 20% overlap, recursive by separators;
- streaming: server-sent events, and `fetch` with a `ReadableStream` to POST a body;
- a tool loop: call the model, run the requested tools, feed results back, with a step cap,
  per-tool timeouts, an allowlist and approval before write actions;
- structured output: validate against a schema, retry with the error fed back, then fall back;
- prompt injection: retrieved and user text is data, never instructions; least-privilege
  tools; confirm writes;
- evals: a golden set, retrieval metrics (recall@k, MRR) kept apart from answer metrics
  (faithfulness, relevance), a regression gate in CI;
- cost and latency: model per step, caching, streaming, parallel calls.

Design questions: walk a RAG pipeline end to end and say where it breaks; the boundary
between read and write tools; streaming a 30-second agent run and failing mid-stream;
stopping a loop that never ends; multi-tenant isolation.

Sources:

- https://github.com/alexeygrigorev/ai-engineering-field-guide
- https://fdeinterviews.com/c/rag-agents

## 6. AI-assisted rounds

- **Meta** (since October 2025): 60 minutes in a live coding interview tool with a file tree and an AI chat that
  reads but cannot edit the files. One multi-file problem in three phases: fix a bug (type
  casts, off-by-one, wrong conditions; best done by reading, without AI), implement a core
  feature of about 120 lines, then optimise for tiered large inputs. Scored on problem
  solving, code quality, verification and communication. The quoted rule: use AI, but show
  you understand the code; test before relying on it; do not prompt your way out.
- **Canva** (since June 2025): candidates are expected to use Copilot, Cursor or Claude.
  Graded on breaking down vague requirements, technical decisions, and catching and fixing
  problems in generated code. In the pilot, the strongest candidates asked clarifying
  questions and reviewed what the AI wrote; those new to AI tools struggled to steer them.
  Advice: say what you think before you ask the AI.
- **Shopify**: bring your own tools. Interviewers watch whether you fix a one-character bug
  by hand rather than prompting again, and may ask you to run real coverage instead of
  trusting a claim.
- **Some companies forbid AI** in interviews and take-homes unless told otherwise.

The rule for every process: ask, for each round, whether AI tools are allowed.

Sources:

- https://www.hellointerview.com/blog/meta-ai-enabled-coding
- https://www.canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews/
- https://www.canva.dev/blog/engineering/ai-interview-success/
- https://www.anthropic.com/candidate-ai-guidance

## 7. Build and present

What reviewers grade: a working vertical slice, scoping judgement, code quality, error and
empty states, tests on the core logic, a README (what, how to run, assumptions, architecture,
trade-offs, next steps), readable commits, and whether you can defend each decision. For AI
builds add a small eval set, cost and latency notes, and guardrails. First reviews take
minutes; the discussion often counts more than the code.

A four-hour plan:

| Time      | Do                                                                        |
| --------- | ------------------------------------------------------------------------- |
| 0:00–0:20 | Read the brief, ask questions, write assumptions and three must-haves     |
| 0:20–0:35 | Skeleton: a thin path from UI through API to data, running                |
| 0:35–2:15 | The core happy path end to end, committing often                          |
| 2:15–2:50 | Error, empty and loading states, validation, guardrails, a small eval set |
| 2:50–3:15 | Tests on the core logic                                                   |
| 3:15–3:40 | README with a diagram, trade-offs, next steps and how you used AI         |
| 3:40–4:00 | Rehearse the demo, prepare a fallback, stop adding features               |

A 10 to 15 minute presentation: the problem and what success means (1 min); the constraint
and your scoping call (1 min); a diagram and two or three decisions, each with the option you
rejected (3 min); a live demo of one realistic path (4 to 5 min); evidence: tests, evals,
known gaps (2 min); what you would do next, then invite the hardest question. Leave a third of
the slot for questions.

Follow-up questions to rehearse: why X over Y; what breaks first and how would you know; what
happens at 100 times the load; what did you leave out on purpose; walk me through this
function; how did you test it; where did AI help and how did you check it; what would you do
with another day; how would you handle security, auth and personal data.

Failure modes: too much built and the core flow unfinished; setup that fails on a clean
machine; no tests; unwritten assumptions; a feature tour instead of decisions; unable to
explain generated code; one giant commit; secrets committed; infrastructure with no reason.
Deflecting with "the team decided" ends a deep-dive round.

Sources:

- https://www.f1jobs.io/resources/blog/take-home-assignment-interview-guide
- https://www.coditioning.com/blog/34/anthropic-swe-project-deep-dive

## 8. Senior signals in live coding

The four rubric areas: communication, problem solving, technical competency, testing
(https://www.techinterviewhandbook.org/coding-interview-rubrics/). The senior bar adds fluent,
idiomatic code; edge cases handled before anyone asks; clarity made from vague requirements;
trade-offs stated as a default, what would change it, and how it fails; code that extends to
the next level; taking hints well; checkpoints rather than narrating every keystroke.

The script:

1. Restate the problem and confirm inputs, outputs and constraints.
2. Work one small example by hand.
3. Say the brute force and its cost.
4. Improve it, and say why it is faster.
5. Agree the plan before coding.
6. Code with clear names and small helpers.
7. Test a normal case, a boundary and a nasty one, then trace the code.
8. State the final time and space cost, and the next extension.

With an assistant in the room: plan aloud first, prompt in pieces you can review, run the
tests, fix small things by hand, and be ready to explain every line.
