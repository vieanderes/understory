'use client';

import { useSyncExternalStore } from 'react';
import {
  reduceAttempt,
  type AttemptAction,
  type AttemptState,
  type TaskLanguage,
  type TaskResult,
} from '@/core/online-test';

/*
 * The sitting in progress, per test, and the finished reports. They live in localStorage
 * so that closing the tab and coming back works like the platform's invitation link: the
 * clock kept running, the code is where it was. They are not learning facts; the tallies
 * of a finished test go to the event log (online_test_submitted).
 *
 * Every access may fail in a private window. The page then keeps working from memory.
 */

const ATTEMPT = 'understory:online-test:attempt:';
const REPORT = 'understory:online-test:report:';
const REPORT_INDEX = 'understory:online-test:reports';
const MAX_REPORTS = 30;

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readRaw(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Quota or a private window: memory holds it for this page.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith('understory:online-test:')) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Parsed once per stored string, so useSyncExternalStore sees a stable snapshot. */
const parsed = new Map<string, { raw: string; value: unknown }>();
function readJson<T>(key: string): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  const hit = parsed.get(key);
  if (hit?.raw === raw) return hit.value as T;
  try {
    const value: unknown = JSON.parse(raw);
    parsed.set(key, { raw, value });
    return value as T;
  } catch {
    return null;
  }
}

// ---- Attempts -------------------------------------------------------------------------

export function readAttempt(testKey: string): AttemptState | null {
  return readJson<AttemptState>(ATTEMPT + testKey);
}

export function writeAttempt(state: AttemptState | null, testKey: string): void {
  writeRaw(ATTEMPT + testKey, state === null ? null : JSON.stringify(state));
}

export function dispatchAttempt(testKey: string, action: AttemptAction): AttemptState | null {
  const current = readAttempt(testKey);
  if (!current) return null;
  const next = reduceAttempt(current, action);
  if (next !== current) writeAttempt(next, testKey);
  return next;
}

export function useAttempt(testKey: string): AttemptState | null {
  return useSyncExternalStore(
    subscribe,
    () => readAttempt(testKey),
    () => null,
  );
}

// ---- Reports --------------------------------------------------------------------------

export interface ReportTask {
  taskId: string;
  title: string;
  language: TaskLanguage;
  code: string;
  result: TaskResult;
  complexity?: string;
}

export interface Survey {
  rating?: number;
  difficulty?: 'easy' | 'right' | 'hard';
  comment?: string;
}

export interface StoredReport {
  attemptId: string;
  attempt: AttemptState;
  tasks: ReportTask[];
  survey?: Survey;
}

export function saveReport(report: StoredReport): void {
  writeRaw(REPORT + report.attemptId, JSON.stringify(report));
  const ids = (readJson<string[]>(REPORT_INDEX) ?? []).filter((id) => id !== report.attemptId);
  const next = [report.attemptId, ...ids];
  for (const stale of next.slice(MAX_REPORTS)) writeRaw(REPORT + stale, null);
  writeRaw(REPORT_INDEX, JSON.stringify(next.slice(0, MAX_REPORTS)));
}

export function readReport(attemptId: string): StoredReport | null {
  return readJson<StoredReport>(REPORT + attemptId);
}

export function useReport(attemptId: string | null): StoredReport | null {
  return useSyncExternalStore(
    subscribe,
    () => (attemptId ? readReport(attemptId) : null),
    () => null,
  );
}

export function saveSurvey(attemptId: string, survey: Survey): void {
  const report = readReport(attemptId);
  if (report) saveReport({ ...report, survey });
}

/** Every stored attempt key in progress, for the hub's "Resume". */
export function useAttemptsInProgress(keys: readonly string[]): AttemptState[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => keys.map((key) => readRaw(ATTEMPT + key) ?? '').join('\u0000'),
    () => '',
  );
  return snapshot
    .split('\u0000')
    .filter((raw) => raw.length > 0)
    .flatMap((raw) => {
      try {
        return [JSON.parse(raw) as AttemptState];
      } catch {
        return [];
      }
    });
}

/** A short random id; attempts are local, so uniqueness per device is enough. */
export function newAttemptId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
