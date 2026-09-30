'use client';

import { useSyncExternalStore } from 'react';

/*
 * The assistant's unsent message, outside the panel, so the guide can put a prompt in it:
 * "Put in the assistant" fills the box and the candidate still decides to send it. A store
 * rather than a prop, because the guide and the panel are siblings, and the panel may not
 * be mounted when the guide writes.
 */

let draft = '';
const listeners = new Set<() => void>();

export function setAssistantDraft(text: string): void {
  draft = text;
  listeners.forEach((notify) => notify());
}

export function useAssistantDraft(): [string, (text: string) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => draft,
    () => '',
  );
  return [value, setAssistantDraft];
}
