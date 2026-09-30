'use client';

import { useSyncExternalStore } from 'react';

/*
 * When the current attempt at an assessment started, per lesson, for as long as the tab
 * lives. It is not a learning fact: the scores are, and they go to the event log on
 * submit. It lives in sessionStorage so a reload keeps the clock running, as on the real
 * platforms, and every access may fail quietly in a private window.
 */

const PREFIX = 'understory:assessment:';
const listeners = new Set<() => void>();

function read(lessonId: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + lessonId);
    const at = raw === null ? NaN : Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return memory.get(lessonId) ?? null;
  }
}

/** Where the start goes when storage refuses it, so the attempt still works in this page. */
const memory = new Map<string, number>();

export function setAttemptStart(lessonId: string, at: number | null): void {
  if (at === null) memory.delete(lessonId);
  else memory.set(lessonId, at);
  try {
    if (at === null) window.sessionStorage.removeItem(PREFIX + lessonId);
    else window.sessionStorage.setItem(PREFIX + lessonId, String(at));
  } catch {
    // The in-memory copy stands in.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Null on the server and before an attempt, so the first paint is always the brief. */
export function useAttemptStart(lessonId: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => read(lessonId),
    () => null,
  );
}

// ---- A clock that ticks every second, only while someone is watching ------------------

const TICK_MS = 1000;
let now = 0;
const clockListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      clockListeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Milliseconds since the epoch, stable between ticks. 0 on the server. */
export function useSecondClock(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => (now ||= Date.now()),
    () => 0,
  );
}
