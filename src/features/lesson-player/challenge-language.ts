'use client';

import { useSyncExternalStore } from 'react';

/*
 * The language a learner practises twinned challenges in (src/core/content/twin.ts). A
 * display preference, not a fact, so it stays out of the event log and lives in
 * localStorage: choosing Python once shows Python on every step that has a Python twin,
 * across lessons and tabs. Storage may refuse; then the choice lasts until the reload.
 */

export const CHALLENGE_LANGUAGE_KEY = 'understory:challenge-language';

const listeners = new Set<() => void>();
// What this tab chose when storage refused it, so the switch still answers.
let refused: string | null = null;

/** The preferred language now, for code that runs outside a render, such as a finished run. */
export function readChallengeLanguage(): string | null {
  if (refused !== null) return refused;
  try {
    return window.localStorage.getItem(CHALLENGE_LANGUAGE_KEY);
  } catch {
    return null;
  }
}

function onStorage(event: StorageEvent): void {
  if (event.key !== CHALLENGE_LANGUAGE_KEY && event.key !== null) return;
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Remembers the choice and tells every open challenge in this tab at once. */
export function setChallengeLanguage(language: string): void {
  try {
    window.localStorage.setItem(CHALLENGE_LANGUAGE_KEY, language);
    refused = null;
  } catch {
    refused = language;
  }
  for (const notify of listeners) notify();
}

/** The preferred language, or null before any choice and on the server. */
export function useChallengeLanguage(): string | null {
  return useSyncExternalStore(subscribe, readChallengeLanguage, () => null);
}
