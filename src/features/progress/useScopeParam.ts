'use client';

import { useSyncExternalStore } from 'react';

/*
 * The Progress scope lives in the URL (`?scope=part-data`), so a view can be shared and
 * survives a reload, and the page itself stays static. It is read as external state:
 * changing it rewrites the URL and tells the subscribers, never a mirrored useState.
 */

const CHANGED = 'understory:scope';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function useScopeParam(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get('scope'),
    () => null,
  );
}

/** Replaces the scope in the URL, keeping the hash, without a navigation. */
export function setScopeParam(scope: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('scope', scope);
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(CHANGED));
}
