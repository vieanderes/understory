'use client';

import { useSyncExternalStore } from 'react';

/*
 * "Now", as external state. Mastery and due counts depend on the clock, and the server
 * has no business guessing the learner's. The value ticks once a minute, which is as
 * fast as anything on these screens can change, and is null until the client has mounted.
 */
const TICK_MS = 60_000;
let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): Date | null {
  const ms = useSyncExternalStore(
    subscribe,
    // The snapshot must be stable between ticks, or React re-renders for ever.
    () => (current ||= Date.now()),
    () => 0,
  );
  return ms === 0 ? null : new Date(ms);
}
