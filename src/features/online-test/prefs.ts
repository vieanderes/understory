'use client';

import { useSyncExternalStore } from 'react';

/*
 * Editor preferences that outlive a test: Vim mode and accessibility mode (larger code,
 * as the platform's accessibility mode zooms the IDE). The theme is the app's own
 * (src/components/theme/ThemeToggle.tsx), so the IDE's switch and the app's agree.
 */

export interface OnlineTestPrefs {
  vim: boolean;
  accessibility: boolean;
}

const KEY = 'understory:online-test:prefs';
const DEFAULTS: OnlineTestPrefs = { vim: false, accessibility: false };
const listeners = new Set<() => void>();
let memory: string | null = null;
let cached: { raw: string | null; value: OnlineTestPrefs } = { raw: null, value: DEFAULTS };

function read(): OnlineTestPrefs {
  let raw: string | null = memory;
  try {
    raw = window.localStorage.getItem(KEY) ?? memory;
  } catch {
    // Private mode: memory only.
  }
  if (raw === cached.raw) return cached.value;
  let value = DEFAULTS;
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Partial<OnlineTestPrefs>;
      value = { vim: p.vim === true, accessibility: p.accessibility === true };
    }
  } catch {
    value = DEFAULTS;
  }
  cached = { raw, value };
  return value;
}

export function setPrefs(change: Partial<OnlineTestPrefs>): void {
  const raw = JSON.stringify({ ...read(), ...change });
  memory = raw;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Kept in memory for this page.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function usePrefs(): OnlineTestPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}
