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

export function applyDelta(draft: AssistantDraft, delta: Delta): AssistantDraft {
  void draft;
  void delta;
  throw new Error('Not implemented');
}
