'use client';

import { useSyncExternalStore } from 'react';
import type { LibraryEntry } from '@/core/scout';
import type { ScoutLibraryFile } from '@/lib/content';

/*
 * The course's references, fetched once when Scout first opens: a static file built with
 * the site (/api/scout/library). Until it arrives, or if it fails, Scout has no library and
 * the Librarian says it cannot recommend.
 */

let entries: readonly LibraryEntry[] | null = null;
let started = false;
const listeners = new Set<() => void>();

function load(): void {
  if (started) return;
  started = true;
  fetch('/api/scout/library')
    .then((response) => (response.ok ? (response.json() as Promise<ScoutLibraryFile>) : null))
    .then((file) => {
      entries = file?.entries ?? null;
    })
    .catch(() => {
      entries = null;
    })
    .finally(() => {
      // A failure may pass; the next open tries again.
      if (!entries) started = false;
      listeners.forEach((listener) => listener());
    });
}

export function useScoutLibrary(): readonly LibraryEntry[] | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      load();
      return () => listeners.delete(listener);
    },
    () => entries,
    () => null,
  );
}
