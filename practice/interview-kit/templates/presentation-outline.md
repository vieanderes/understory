# Presentation outline: 10 to 15 minutes

Leave a third of the slot for questions. For a 15-minute slot, talk for 10. Rehearse once
aloud with a timer before you present. Prepare a fallback: a recording or screenshots of
the demo path, in case something breaks live.

| Time        | Section                              | Say                                                                                                     |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 0:00-1:00   | The problem and what success means   | Who it is for, the one thing it must do well, how you would know it works.                              |
| 1:00-2:00   | The constraint and your scoping call | Four hours. The three must-haves you chose and what you left out on purpose.                            |
| 2:00-5:00   | A diagram and two or three decisions | Walk the diagram once. For each decision: the option you rejected and why.                              |
| 5:00-9:30   | A live demo of one realistic path    | One path end to end, with real data. Include a failure: a refusal, a stop, an error state.              |
| 9:30-11:30  | Evidence                             | Tests and what they cover. For AI builds, the eval numbers and one failure the eval caught. Known gaps. |
| 11:30-12:30 | Next steps, then invite questions    | What you would do with another day, in order. Then: "What would you like to dig into?"                  |

## Principles

- Decisions, not a feature tour. "I chose X over Y because Z" is the sentence reviewers
  remember.
- Show the failure path on purpose. It proves the error handling exists.
- Say the gaps before they are found.
- Numbers over adjectives: "recall@3 is 0.9 on 20 questions", not "retrieval works well".
- Own every line. "The assistant wrote that part, and here is how I checked it" is fine.
  "I am not sure what that does" is not. Never answer with "the team decided".

## Before you start

- [ ] App running, data loaded, browser zoomed so the back row can read it.
- [ ] Terminal with tests and eval ready to run.
- [ ] Notifications off. Secrets not on screen.
- [ ] Fallback recording or screenshots open in a tab.
- [ ] README open, diagram visible.
