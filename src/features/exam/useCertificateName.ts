'use client';

import { useSyncExternalStore } from 'react';

/*
 * The name printed on a certificate. It stays on this device, in localStorage, and never
 * enters the progress log: a name is not a learning fact, and the log is what syncs.
 */
const KEY = 'understory.certificate-name';
const listeners = new Set<() => void>();
/** Used only when storage refuses (private mode, a full store): the name lasts for the page. */
let unsaved = '';

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return unsaved;
  }
}

function write(name: string): void {
  try {
    if (name === '') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, name);
  } catch {
    unsaved = name;
  }
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the name.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useCertificateName(): [string, (name: string) => void] {
  return [useSyncExternalStore(subscribe, read, () => ''), write];
}
