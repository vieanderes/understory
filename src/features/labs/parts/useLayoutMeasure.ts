'use client';

import { useLayoutEffect, useState, useSyncExternalStore } from 'react';

interface Store<T> {
  get: () => T | null;
  set: (next: T | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function createStore<T>(): Store<T> {
  let value: T | null = null;
  let key = 'null';
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      // Compared by content, so measuring after every render settles instead of looping.
      const nextKey = JSON.stringify(next);
      if (nextKey === key) return;
      key = nextKey;
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Reads the browser's layout after every commit and returns the last reading. The layout
 * is an external system, so the reading lives in a store read with useSyncExternalStore
 * rather than in state set from an effect. It is read again when the window resizes and
 * when web fonts arrive, because both change text widths.
 *
 * `measure` must return plain JSON (numbers, arrays, objects) or null when the stage is
 * not mounted. On the server and in the first client render the reading is null.
 */
export function useLayoutMeasure<T>(measure: () => T | null): T | null {
  const [store] = useState(() => createStore<T>());

  useLayoutEffect(() => {
    store.set(measure());
  });

  useLayoutEffect(() => {
    const again = () => store.set(measure());
    window.addEventListener('resize', again);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) again();
    });
    return () => {
      live = false;
      window.removeEventListener('resize', again);
    };
    // `measure` closes over refs only, so the first one stays valid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  return useSyncExternalStore(store.subscribe, store.get, () => null);
}
