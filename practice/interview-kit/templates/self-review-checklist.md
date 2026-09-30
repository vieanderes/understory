# Self-review checklist

Run through this at 3:40, before you rehearse, and again after the session to score
yourself.

## It runs

- [ ] A fresh clone installs and starts with the commands in the README, and nothing else.
- [ ] It runs without a paid key, or the README says exactly which key and why.
- [ ] No secrets in the repository or its history. `.env` is ignored; `.env.example` exists.
- [ ] The demo path works three times in a row.

## Scope

- [ ] The three must-haves are done, or honestly marked partial.
- [ ] Nothing half-built is visible in the demo path.
- [ ] Assumptions are written down.

## Code

- [ ] The core logic is in small named functions, apart from the framework code.
- [ ] Inputs are validated at the edge, with one error format.
- [ ] Error, empty and loading states exist for the main screen.
- [ ] No dead code, no commented-out code, no stray `console.log`.
- [ ] Comments explain why, not what.
- [ ] I can explain every line, including the ones an assistant wrote.

## Tests and evals

- [ ] Tests cover the core logic, including one boundary and one failure case.
- [ ] External things (clock, network, model) are faked in tests.
- [ ] AI builds: a golden set exists, the eval runs with one command, the numbers are in the
      README.
- [ ] AI builds: there is at least one guardrail (refusal, approval of writes, schema
      validation) and a test for it.

## History

- [ ] Several commits with messages that say what changed, not one giant commit.

## README

- [ ] What, how to run, assumptions, a diagram, trade-offs with the rejected option, how
      AI was used and checked, testing, known gaps, next steps.

## Presentation

- [ ] Rehearsed once with a timer; fits in two thirds of the slot.
- [ ] Two or three decisions, each with the option I rejected.
- [ ] The demo includes one failure path.
- [ ] A fallback recording or screenshots are ready.
- [ ] I have answers ready for: what breaks first, what I left out, what next.
