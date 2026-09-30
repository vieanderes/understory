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

function fail(state: ChatState, message: string): ChatState {
  return { ...state, status: 'error', error: message, canRetry: true };
}

export function reduceStream(state: ChatState, event: StreamEvent): ChatState {
  // A finished message ignores stragglers, such as events from a stream that was cancelled.
  if (state.status !== 'streaming') return state;
  switch (event.type) {
    case 'text-delta':
      return { ...state, text: state.text + event.text };
    case 'tool-call-start':
      return {
        ...state,
        toolCalls: [...state.toolCalls, { id: event.id, name: event.name, argsText: '', args: null, complete: false }],
      };
    case 'tool-call-delta':
      return {
        ...state,
        toolCalls: state.toolCalls.map((call) =>
          call.id === event.id ? { ...call, argsText: call.argsText + event.argsDelta } : call,
        ),
      };
    case 'tool-call-end': {
      const call = state.toolCalls.find((c) => c.id === event.id);
      if (!call) return state;
      let args: unknown;
      // Fragments are rarely valid JSON on their own, so arguments are parsed once, at the end.
      try {
        args = JSON.parse(call.argsText === '' ? '{}' : call.argsText);
      } catch {
        return fail(state, `Invalid arguments for ${call.name}`);
      }
      return {
        ...state,
        toolCalls: state.toolCalls.map((c) => (c.id === event.id ? { ...c, args, complete: true } : c)),
      };
    }
    case 'done':
      return { ...state, status: 'done' };
    case 'error':
      return fail(state, event.message);
  }
}

export async function collect(events: AsyncIterable<StreamEvent>, signal: Signal): Promise<ChatState> {
  let state = initialState;
  try {
    for await (const event of events) {
      if (signal.aborted) return { ...state, status: 'cancelled', canRetry: true };
      state = reduceStream(state, event);
      if (state.status !== 'streaming') return state;
    }
  } catch (error) {
    // Aborting a fetch rejects the read, so a throw after an abort is a cancel, not a failure.
    if (signal.aborted) return { ...state, status: 'cancelled', canRetry: true };
    return fail(state, error instanceof Error ? error.message : String(error));
  }
  if (signal.aborted) return { ...state, status: 'cancelled', canRetry: true };
  return fail(state, 'The stream ended early');
}
