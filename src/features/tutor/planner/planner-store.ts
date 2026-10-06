'use client';

import { useSyncExternalStore } from 'react';
import type { Draft, PathBlock } from '@/core/planner';
import type { OwnPath } from '@/core/progress';
import { clearHistory, setTutorOpen } from '../tutor-store';

/*
 * Plan mode of Scout's panel (docs/ONLINE-TEST.md, section 6, "Planning a path"): which mode
 * the panel is in, and the draft being planned. Kept in this browser beside the conversation,
 * like the conversation itself, and not a learning fact: only Save writes to the event log.
 */

/** The conversation's key in tutor-store: one planning conversation, the same on every page. */
export const PLANNER_KEY = 'planner';

export type ScoutMode = 'ask' | 'plan';

export interface PlannerState {
  /** The newest path Scout drafted, as it wrote it; checked against the course when read. */
  block?: PathBlock;
  /** The draft once the learner changed it by hand, or the path being planned again. */
  edited?: Draft;
  /** The own path this conversation saves to: set by the first save, or by planning again. */
  pathId?: string;
  /** The draft as last saved, so Save knows whether there is anything new. */
  savedAs?: string;
  /** The path being planned again, for the opening question. */
  seedName?: string;
}

const STORE_KEY = 'understory:planner';
const MODE_KEY = 'understory:scout:mode';
const EMPTY: PlannerState = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

let state: PlannerState | undefined;
let mode: ScoutMode | undefined;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A private window or a full quota: it lasts for this visit.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function current(): PlannerState {
  state ??= read<PlannerState>(STORE_KEY, EMPTY);
  return state;
}

function update(next: PlannerState): void {
  state = next;
  write(STORE_KEY, next);
  notify();
}

export function usePlanner(): PlannerState {
  return useSyncExternalStore(subscribe, current, () => EMPTY);
}

export function useScoutMode(): ScoutMode {
  return useSyncExternalStore(
    subscribe,
    () => (mode ??= read<ScoutMode>(MODE_KEY, 'ask')),
    () => 'ask',
  );
}

export function setScoutMode(next: ScoutMode): void {
  mode = next;
  write(MODE_KEY, next);
  notify();
}

/** Scout drafted a path: it replaces the hand-edited one, which Scout was shown. */
export function takeBlock(block: PathBlock): void {
  const { pathId, savedAs } = current();
  update({ block, ...(pathId ? { pathId } : {}), ...(savedAs ? { savedAs } : {}) });
}

export function editDraft(draft: Draft): void {
  update({ ...current(), edited: draft });
}

export function markSaved(pathId: string, draft: Draft): void {
  update({ ...current(), pathId, savedAs: draftKey(draft) });
}

/** Starts over: a new conversation, a new path. It returns the undo. */
export function resetPlanner(): () => void {
  const before = current();
  update(EMPTY);
  return () => update(before);
}

/** What makes two drafts the same path, for "is there anything to save". */
export function draftKey(draft: Draft): string {
  const { name, summary, minutesPerWeek, deadline, stages } = draft;
  return JSON.stringify({ name, summary, minutesPerWeek, deadline, stages });
}

export function draftFromOwnPath(path: OwnPath): Draft {
  return {
    name: path.name,
    alternatives: [],
    summary: path.summary ?? '',
    ...(path.pace?.minutesPerWeek ? { minutesPerWeek: path.pace.minutesPerWeek } : {}),
    ...(path.pace?.deadline ? { deadline: path.pace.deadline } : {}),
    stages: (path.stages ?? [{ title: 'Your lessons', lessonIds: path.lessonIds }]).map((s) => ({
      title: s.title,
      why: s.why ?? '',
      lessonIds: [...s.lessonIds],
    })),
  };
}

/**
 * Opens Scout in plan mode, from any page. With a path, planning starts again from it: a
 * fresh conversation that saves back to the same path.
 */
export function openScoutPlanner(path?: OwnPath): void {
  setScoutMode('plan');
  if (path) {
    clearHistory(PLANNER_KEY);
    const draft = draftFromOwnPath(path);
    update({ edited: draft, pathId: path.id, savedAs: draftKey(draft), seedName: path.name });
  }
  setTutorOpen(true);
}
