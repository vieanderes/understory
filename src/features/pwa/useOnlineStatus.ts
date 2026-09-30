'use client';

import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void): () => void {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

/**
 * Whether the browser believes it has a network. `navigator.onLine` is only wrong in one
 * direction: true on a network with no way out. So false is safe to show as "Offline".
 * The server and the first client render say online, so the markup matches.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
