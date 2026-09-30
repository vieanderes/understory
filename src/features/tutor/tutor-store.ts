'use client';

import { useSyncExternalStore } from 'react';

/*
 * The study assistant's two pieces of outside state (src/features/tutor):
 *
 *  - what the learner is looking at, published by the page (the lesson player sets the
 *    lesson and the step), so the tutor answers about the screen, not in general;
 *  - the conversation, kept per lesson in this browser, so coming back to a lesson brings
 *    its questions back. Not a learning fact: nothing here goes to the event log.
 */

export interface TutorScope {
  /** Where the conversation belongs: a lesson id, or the page path elsewhere. */
  key: string;
  title: string;
  /** The text on screen, as plain text. */
  onScreen: string;
  code?: string;
  language?: string;
}

export interface TutorMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

// ---- What is on screen ------------------------------------------------------------------

let scope: TutorScope | null = null;
const scopeListeners = new Set<() => void>();

export function setTutorScope(next: TutorScope | null): void {
  scope = next;
  scopeListeners.forEach((notify) => notify());
}

export function useTutorScope(): TutorScope | null {
  return useSyncExternalStore(
    (onChange) => {
      scopeListeners.add(onChange);
      return () => scopeListeners.delete(onChange);
    },
    () => scope,
    () => null,
  );
}

// ---- The conversation -------------------------------------------------------------------

const PREFIX = 'understory:tutor:';
const MAX_MESSAGES = 120;
const memory = new Map<string, string>();
const historyListeners = new Set<() => void>();
const parsed = new Map<string, { raw: string; value: TutorMessage[] }>();
const EMPTY: TutorMessage[] = [];

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function readHistory(key: string): TutorMessage[] {
  const raw = readRaw(key);
  if (raw === null) return EMPTY;
  const hit = parsed.get(key);
  if (hit?.raw === raw) return hit.value;
  try {
    const value = JSON.parse(raw) as TutorMessage[];
    parsed.set(key, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeHistory(key: string, messages: TutorMessage[]): void {
  const raw = JSON.stringify(messages.slice(-MAX_MESSAGES));
  memory.set(key, raw);
  try {
    window.localStorage.setItem(PREFIX + key, raw);
  } catch {
    // Quota or a private window: memory keeps it for this visit.
  }
  historyListeners.forEach((notify) => notify());
}

export function appendMessage(key: string, message: TutorMessage): void {
  writeHistory(key, [...readHistory(key), message]);
}

export function clearHistory(key: string): void {
  writeHistory(key, []);
}

/** Puts a cleared conversation back: the undo after "New chat". */
export function restoreHistory(key: string, messages: TutorMessage[]): void {
  writeHistory(key, messages);
}

export function useHistory(key: string): TutorMessage[] {
  return useSyncExternalStore(
    (onChange) => {
      historyListeners.add(onChange);
      return () => historyListeners.delete(onChange);
    },
    () => readHistory(key),
    () => EMPTY,
  );
}

// ---- Open and docked --------------------------------------------------------------------

/*
 * Whether the panel is open lives here, so a page can open it from its own control. A page
 * with a fixed bar of its own (the lesson player) docks the trigger in that bar and the
 * floating button steps aside, instead of sitting on top of the bar.
 */
let open = false;
let docked = 0;
const uiListeners = new Set<() => void>();
const notifyUi = () => uiListeners.forEach((notify) => notify());

// Whatever opened the panel (the corner button, the sidebar row, a lesson's bar, or the
// focus the shortcut was pressed from) gets focus back when it closes.
let opener: HTMLElement | null = null;

export function setTutorOpen(next: boolean): void {
  if (next === open) return;
  if (next) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  open = next;
  notifyUi();
  if (!next) {
    opener?.focus();
    opener = null;
  }
}

/** A page that shows its own trigger calls this while mounted; it returns the undo. */
export function dockTutorTrigger(): () => void {
  docked += 1;
  notifyUi();
  return () => {
    docked -= 1;
    notifyUi();
  };
}

/*
 * A page that measures what the learner knows without help (a timed assessment, the
 * placement test) withholds the assistant while mounted: no floating button to sit on its
 * controls, and no panel. The route list in StudyAssistant covers whole routes; this covers
 * the timed lessons, which share their route with ordinary ones.
 */
let withheld = 0;

/** Hides the assistant while the caller is mounted; it returns the undo. */
export function withholdTutor(): () => void {
  withheld += 1;
  setTutorOpen(false);
  notifyUi();
  return () => {
    withheld -= 1;
    notifyUi();
  };
}

export function useTutorWithheld(): boolean {
  return useSyncExternalStore(
    subscribeUi,
    () => withheld > 0,
    () => false,
  );
}

function subscribeUi(onChange: () => void): () => void {
  uiListeners.add(onChange);
  return () => uiListeners.delete(onChange);
}

export function useTutorOpen(): boolean {
  return useSyncExternalStore(
    subscribeUi,
    () => open,
    () => false,
  );
}

export function useTutorDocked(): boolean {
  return useSyncExternalStore(
    subscribeUi,
    () => docked > 0,
    () => false,
  );
}
