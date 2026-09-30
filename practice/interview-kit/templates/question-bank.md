# Question bank

Follow-up questions from build-and-present sessions and live rounds, with what a strong
answer contains. Practise aloud; aim for two minutes each. A strong answer is usually: the
default, what would change it, and how it fails.

## About your decisions

**Why X over Y?**
Name both options fairly. State the constraint that decided it (time, team, scale, the
brief). Say what would make you switch. Avoid "X is better".

**What did you leave out on purpose?**
Two or three items, each with why it was lower value for this brief, and how you would add
it without a rewrite.

**What would you do with another day?**
An ordered list tied to risk: first what makes it safe (tests, auth, error handling), then
what makes it useful, then polish.

**Walk me through this function.**
Purpose in one sentence, inputs and outputs, the tricky branch, the test that covers it.
Read it; do not recite from memory.

## About failure and scale

**What breaks first, and how would you know?**
Name the component (the model's rate limit, the database's slowest query, memory in the
index). Name the signal: a metric, a log line, an alert threshold. Then the fix.

**What happens at 100 times the load?**
Separate reads from writes. Where state lives. What you would cache and how it goes stale.
Queueing for slow work. Cost at that volume, for AI builds.

**A dependency times out half way through a write. What happened?**
You cannot know from the client. Idempotency keys, a status you can query, and retries
that are safe because of the key.

**How did you test it?**
What is unit-tested and why that layer. What you faked and why (the clock, the model, the
network). One case you would add. For AI builds, the eval set and the numbers.

## About AI builds

**Walk a RAG request end to end. Where does it break?**
Chunking (split answers), embedding (vocabulary mismatch), retrieval (recall), the
threshold (false refusals against wrong answers), generation (unfaithful answers),
citations (pointing at the wrong chunk). For each, the metric that shows it.

**How did you evaluate it?**
A golden set written early, including questions that must be refused. Retrieval metrics
(recall@k, MRR) apart from answer metrics (faithfulness, relevance). A gate in CI. How you
would grow the set from real traffic.

**How do you handle prompt injection?**
Retrieved and user text is data, never instructions: delimit it and say so. Least-privilege
tools. Writes need approval. Validate tool arguments in code. Test with an injected
document.

**The agent loops forever. What stops it?**
A step cap, a token or cost budget, per-tool timeouts, and detection of repeated identical
calls. What the user sees when it stops.

**What does one request cost, and how would you make it cheaper?**
Tokens in and out per step, the model per step, caching of the stable prompt prefix,
smaller models for simple steps, fewer steps. Measure before changing.

## About how you worked

**Where did AI help, and how did you check it?**
Specific: which parts, which tool. How you verified: tests, reading, running. One thing it
got wrong. Be able to explain every line it wrote.

**How would you handle security, auth and personal data?**
Authentication at the edge, authorisation per resource, tenant isolation in every query.
Secrets outside the code. Personal data minimised, not sent to a model unless needed, and
logs scrubbed.

**Tell me about a trade-off you regret.**
Pick a real one from the build. What you knew then, what you know now, what you would do.
This is a question about judgement, not a trap.
