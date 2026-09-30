'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

/**
 * The path a lesson was opened from, carried as `?path=<id>` so static lesson pages stay
 * static. Read from the URL as external state, never mirrored into React state.
 */
export function usePathParam(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get('path'),
    () => null,
  );
}
