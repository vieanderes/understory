import type { Delta } from '../fixtures/stream';

export interface ToolCall {
  id: string;
  name: string;
  argsText: string;
  args?: unknown;
  error?: string;
}

export interface AssistantDraft {
  text: string;
  toolCalls: ToolCall[];
  done: boolean;
}

export const EMPTY_DRAFT: AssistantDraft = { text: '', toolCalls: [], done: false };

function finalise(call: ToolCall): ToolCall {
  try {
    return { ...call, args: JSON.parse(call.argsText === '' ? '{}' : call.argsText) };
  } catch {
    // Never guess at half-formed arguments: a tool run on wrong input is worse than none.
    return { ...call, error: 'Invalid JSON arguments' };
  }
}

export function applyDelta(draft: AssistantDraft, delta: Delta): AssistantDraft {
  switch (delta.type) {
    case 'text':
      return { ...draft, text: draft.text + delta.text };
    case 'tool_call_start':
      return {
        ...draft,
        toolCalls: [...draft.toolCalls, { id: delta.id, name: delta.name, argsText: '' }],
      };
    case 'tool_call_args': {
      if (!draft.toolCalls.some((call) => call.id === delta.id)) {
        throw new Error(`Arguments for unknown tool call ${delta.id}`);
      }
      return {
        ...draft,
        toolCalls: draft.toolCalls.map((call) =>
          call.id === delta.id ? { ...call, argsText: call.argsText + delta.argsDelta } : call,
        ),
      };
    }
    case 'done':
      return { ...draft, done: true, toolCalls: draft.toolCalls.map(finalise) };
  }
}
