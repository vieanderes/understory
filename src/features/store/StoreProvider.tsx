'use client';

import { initialProgressState } from '@/core/progress';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { getProgressStore } from './client';
import type { ProgressStore, StoreSnapshot } from './progress-store';

const StoreContext = createContext<ProgressStore | null>(null);

/**
 * Pages are static and know nothing about the learner. Progress is a client overlay:
 * this provider opens the log after hydration and every component that shows progress
 * reads it from here. Until the log is read, `status` is 'loading' and components hold
 * their space, so nothing shifts when the numbers arrive.
 */
export function StoreProvider({
  contentRev,
  children,
}: {
  contentRev: string;
  children: React.ReactNode;
}) {
  const store = useMemo(
    () => (typeof window === 'undefined' ? null : getProgressStore(contentRev)),
    [contentRev],
  );

  useEffect(() => {
    void store?.init();
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * Client components are also rendered on the server, where there is no log. Reading the
 * store there is fine as long as nothing is called on it: handlers and effects, the only
 * callers, never run on the server. A call that does happen there is a bug, and says so.
 */
const SERVER_STORE = new Proxy({} as ProgressStore, {
  get(_target, property) {
    throw new Error(`The progress store was used during server rendering (${String(property)}).`);
  },
});

export function useStore(): ProgressStore {
  return useContext(StoreContext) ?? SERVER_STORE;
}

const noopSubscribe = () => () => {};

/** The current snapshot. On the server and before hydration it is the loading snapshot. */
export function useProgress(): StoreSnapshot {
  const store = useContext(StoreContext);
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : getLoadingSnapshot,
    getLoadingSnapshot,
  );
}

const LOADING_SNAPSHOT: StoreSnapshot = {
  status: 'loading',
  state: initialProgressState(),
  eventCount: 0,
  durable: true,
};

function getLoadingSnapshot(): StoreSnapshot {
  return LOADING_SNAPSHOT;
}
