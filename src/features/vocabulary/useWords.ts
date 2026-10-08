'use client';

import { useSyncExternalStore } from 'react';
import type { CompiledDrillWord } from '@/core/content/glossary-schema';

/*
 * The drill words (`words.json`), fetched once per tab and shared, like the course index.
 * Only the review needs them; the service worker keeps a copy so reviews work offline.
 */
let words: readonly CompiledDrillWord[] | null = null;
let failed = false;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(): void {
  request ??= fetch('/content/v1/words.json')
    .then((response) => {
      if (!response.ok) throw new Error(`words.json: ${response.status}`);
      return response.json() as Promise<{ words: CompiledDrillWord[] }>;
    })
    .then((file) => {
      words = file.words;
      failed = false;
    })
    .catch(() => {
      failed = true;
      request = null;
    })
    .finally(() => listeners.forEach((notify) => notify()));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

export function useWords(): { words: readonly CompiledDrillWord[] | null; failed: boolean } {
  const value = useSyncExternalStore(
    subscribe,
    () => words,
    () => null,
  );
  return { words: value, failed: value === null && failed };
}
