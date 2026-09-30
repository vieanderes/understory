'use client';

import { useSyncExternalStore } from 'react';
import type { CatalogFile } from '@/core/practice';

/*
 * The course index, fetched once per tab and shared. It is a static file with a short
 * cache lifetime; the service worker keeps a copy for offline use.
 */
let catalog: CatalogFile | null = null;
let failed = false;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(): void {
  request ??= fetch('/content/v1/catalog.json')
    .then((response) => {
      if (!response.ok) throw new Error(`catalog.json: ${response.status}`);
      return response.json() as Promise<CatalogFile>;
    })
    .then((file) => {
      catalog = file;
    })
    .catch(() => {
      failed = true;
      // Allow a later retry, for example once the network is back.
      request = null;
    })
    .finally(() => listeners.forEach((notify) => notify()));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

export function useCatalog(): { catalog: CatalogFile | null; failed: boolean } {
  const value = useSyncExternalStore(
    subscribe,
    () => catalog,
    () => null,
  );
  return { catalog: value, failed: value === null && failed };
}

/** For non-React callers, such as the session runner. */
export async function getCatalog(): Promise<CatalogFile> {
  load();
  await request;
  if (!catalog) throw new Error('The course index could not be loaded.');
  return catalog;
}
