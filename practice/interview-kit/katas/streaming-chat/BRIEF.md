# Streaming chat

Format: AI product engineering round, 60 to 90 minutes. TypeScript and React.

## The prompt

"Our model endpoint streams its answer as deltas: bits of text, and tool calls whose JSON
arguments arrive in pieces. Build the chat panel. Users must see text as it arrives, be
able to stop a long answer, and recover when the stream dies half way."

## The contract

The stream is given; see `fixtures/stream.ts`. A `StreamFn(messages, signal)` returns an
`AsyncIterable<Delta>`:

- `{ type: 'text', text }`
- `{ type: 'tool_call_start', id, name }`, then any number of
  `{ type: 'tool_call_args', id, argsDelta }` whose concatenation is JSON
- `{ type: 'done' }` last. The iterator throws if the connection fails or the signal aborts.

Part 1, pure logic in `src/draft.ts`: `applyDelta(draft, delta)` returns a new
`AssistantDraft` `{ text, toolCalls, done }` without mutating the old one.

- Text deltas append. Tool call args append to the call with that id, in order. Args for
  an unknown id throw an error that names the id.
- On `done`, parse each call's `argsText` into `args`. Invalid JSON leaves `args`
  undefined and sets `error: 'Invalid JSON arguments'` on that call.

Part 2, `<Chat stream />` in `src/chat.tsx`:

- A textarea labelled "Message" and a "Send" button, disabled while empty or streaming.
  Sending shows the user message, clears the box and streams the reply into a new
  assistant message that updates on every delta.
- The conversation is an ordered list labelled "Conversation". Each message says who
  wrote it ("You" or "Assistant"). The streaming message has `aria-busy="true"`.
- Each tool call shows as "Used tool <name>".
- While streaming, a "Stop" button aborts the signal. The partial text stays, marked
  "Stopped", and counts as the assistant's reply in the history.
- If the stream throws for any other reason, keep the partial text and show a
  `role="alert"` "The response was interrupted." with a "Retry" button. Retry drops the
  broken reply and streams again with the same history.
- `stream` receives the history: every user message and every finished or stopped
  assistant reply, oldest first, as `{ role, content }`.

## Constraints

- No libraries. The fake stream needs no network.

## What the interviewer looks for

- A reducer for deltas that is tested without React.
- The abort path treated as a normal outcome, not an error.
- No state updates after unmount or after a stop; the loop checks its own signal.
- Partial tool-call JSON never parsed until the call is complete.
- Talk: server-sent events versus `fetch` with a `ReadableStream`, reconnecting with a
  resume token, rendering markdown safely while it is incomplete, batching renders when
  tokens arrive faster than frames, and showing tool calls that need approval.

Run: `pnpm kata streaming-chat`. Reference: `pnpm kata streaming-chat --solution`.
