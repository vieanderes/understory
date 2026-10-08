'use client';

import { useSyncExternalStore } from 'react';

/*
 * The search and the area live in the URL (`?q=cache&area=sql`), so a filtered view can be
 * shared and the page stays static. Read as external state, like the Progress scope
 * (src/features/progress/useScopeParam.ts): no Suspense, no mirrored useState.
 */

const CHANGED = 'understory:vocabulary-params';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function useUrlParam(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key),
    () => null,
  );
}

/** Sets or clears one parameter without a navigation, keeping the rest of the URL. */
export function setUrlParam(key: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(CHANGED));
}
