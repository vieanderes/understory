# Four-hour builds

Each brief is written the way a panel hands it over: a little vague on purpose. Part of the
test is turning it into three must-haves and written assumptions in the first twenty
minutes.

How to run a session:

1. `pnpm timer 240` in a spare terminal.
2. Read the brief once. Write your questions down. With no one to ask, answer them yourself
   as assumptions in the README; that is what reviewers want to see anyway.
3. Build in a fresh repository, committing often. Use `templates/README-template.md`.
4. At 3:40 stop adding features. Rehearse with `templates/presentation-outline.md`.
5. Afterwards, score yourself with the rubric in the brief and
   `templates/self-review-checklist.md`, and answer the brief's questions aloud.

| Brief                                              | Stresses                                  |
| -------------------------------------------------- | ----------------------------------------- |
| [a-rag-help-assistant.md](a-rag-help-assistant.md) | Retrieval, citations, refusal, evals      |
| [b-triage-agent.md](b-triage-agent.md)             | Tool loop, guardrails, approval of writes |
| [c-streaming-chat-app.md](c-streaming-chat-app.md) | Streaming end to end, history, cancel     |
| [d-data-dashboard.md](d-data-dashboard.md)         | API design, filters in the URL, a chart   |

The katas are the parts: `rag-mini` for (a), `retry-backoff` and `promise-pool` for (b),
`streaming-chat` for (c), `bookings-api` and `data-table` for (d).
