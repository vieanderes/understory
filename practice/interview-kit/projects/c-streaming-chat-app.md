# (c) A streaming chat app

## The brief

"We want a chat interface for an assistant. Answers can take twenty seconds, so people
need to see text appear as it is written. They want to come back to old conversations. And
when the assistant heads off in the wrong direction, they want to stop it. Build it."

Use any model provider, or a fake streaming server that emits canned deltas with delays.
Both are fine if you say which and why.

## Must-haves

- A server endpoint that streams the reply (server-sent events, or a streamed `fetch`
  response) and a client that renders it as it arrives.
- Conversations saved and listed; opening one shows its history; a new message sends the
  history to the model.
- A Stop button that cancels on the client and on the server, so the model call ends too.
  The partial reply is kept and marked as stopped.
- A failure mid-stream shows what arrived, says it was interrupted, and offers retry.
- Loading, empty and error states. Keyboard use and screen reader announcements that do not
  read every token.

## Nice-to-haves

- Markdown rendering that copes with half-finished markdown, without injecting HTML.
- Resuming a stream after a dropped connection.
- Titles generated for conversations.
- Token usage and cost per conversation.
- Editing an earlier message and branching.

## The rubric

| Area          | Strong                                                                     | Weak                                                             |
| ------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Scoping       | Streaming and cancel first; persistence second; polish last                | A styled UI with no streaming at 2:00                            |
| Working slice | Stop really stops the upstream call; the demo shows it                     | Stop hides the text but the model keeps generating (and billing) |
| Code quality  | Stream parsing and state are pure and tested; components stay thin         | Parsing inside a `useEffect` with string concatenation           |
| Tests         | Delta reducer, cancel and failure paths tested with a fake stream          | None                                                             |
| Evals         | Not central here; a note on how you would measure answer quality is enough | Claims about quality with no way to check                        |
| README        | Explains the streaming protocol chosen and what happens on disconnect      | No mention of cancellation or failure                            |
| Presentation  | Demos a stop and a failure, not only a happy answer                        | A long answer scrolling past                                     |

## Questions you will be asked

- Why server-sent events (or a streamed fetch) over WebSockets here?
- The user presses Stop. Trace what happens, all the way to the model provider.
- The connection drops at second 15 of 30. What does the user see, and what did you pay for?
- How do you render tokens that arrive faster than the screen refreshes?
- A conversation reaches the model's context limit. What do you do?
- How is one user's history kept from another's?
- A proxy in front of you buffers responses. How would you notice, and what would you change?
- What would you test with more time?
- Which parts did AI write, and how did you verify the streaming code?
