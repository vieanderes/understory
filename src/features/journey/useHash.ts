'use client';

import { useSyncExternalStore } from 'react';

/*
 * The URL fragment as external state, so a deep link such as `/learn#js` can open the part
 * and chapter it names without mirroring the URL into React state in an effect.
 */

function subscribe(notify: () => void): () => void {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}

/** The fragment without its `#`, or '' on the server and when there is none. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => decodeURIComponent(window.location.hash.slice(1)),
    () => '',
  );
}
