import { renderHook } from '@testing-library/react';
import { useAssistantDraft } from '@/features/online-test/assistant-draft';

/** What the assistant's question box holds, read the way the panel reads it. */
export function readAssistantDraftForTest(): string {
  return renderHook(() => useAssistantDraft()).result.current[0];
}
