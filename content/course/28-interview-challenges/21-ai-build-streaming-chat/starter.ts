export type StreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; argsDelta: string }
  | { type: 'tool-call-end'; id: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ToolCallState = { id: string; name: string; argsText: string; args: unknown; complete: boolean };

export type ChatState = {
  status: 'streaming' | 'done' | 'cancelled' | 'error';
  text: string;
  toolCalls: ToolCallState[];
  error: string | null;
  canRetry: boolean;
};

// An AbortSignal has this shape, so a real one can be passed in.
export type Signal = { readonly aborted: boolean };

export const initialState: ChatState = { status: 'streaming', text: '', toolCalls: [], error: null, canRetry: false };

export function reduceStream(state: ChatState, event: StreamEvent): ChatState {
  // Return a new state for each event type. Never change `state` itself.
  if (event.type === 'text-delta') state.text += event.text;
  return state;
}

export async function collect(events: AsyncIterable<StreamEvent>, signal: Signal): Promise<ChatState> {
  // Fold every event with reduceStream. Handle a cancel, a thrown error and a missing `done`.
  let state = initialState;
  for await (const event of events) state = reduceStream(state, event);
  return state;
}
