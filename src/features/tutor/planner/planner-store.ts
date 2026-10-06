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

/**
 * Where planning happens: the path builder, where ticking lessons by hand and planning with
 * Scout edit the same draft. Anywhere else Scout is the usual assistant.
 */
const PLAN_ROUTES = /^\/learn\/build(\/|$)/;

/** The builder, opening Scout to plan: "Plan again with Scout" and Scout's own offer. */
export const planHref = (pathId?: string): string =>
  pathId ? `/learn/build?path=${pathId}&plan=1` : '/learn/build?plan=1';

/** The builder, opening Scout on a new plan whatever was planned before. */
export const NEW_PLAN_HREF = '/learn/build?plan=new';

export const isPlanRoute = (pathname: string): boolean => PLAN_ROUTES.test(pathname);
const EMPTY: PlannerState = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

let state: PlannerState | undefined;
// In memory only: plan mode is a visit to the planner, not a preference to bring back.
let mode: ScoutMode = 'ask';

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
    () => mode,
    () => 'ask',
  );
}

export function setScoutMode(next: ScoutMode): void {
  if (next === mode) return;
  mode = next;
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
 * A new planning conversation, starting from what the builder shows: the lessons ticked so
 * far, or the own path being edited (which it then saves back to).
 */
export function startPlanning(draft: Draft | undefined, path?: { id: string; name: string }): void {
  clearHistory(PLANNER_KEY);
  update({
    ...(draft ? { edited: draft } : {}),
    ...(path ? { pathId: path.id, seedName: path.name } : {}),
    ...(path && draft ? { savedAs: draftKey(draft) } : {}),
  });
}

/** Opens Scout planning, beside the builder. */
export function openScoutPlanner(): void {
  setScoutMode('plan');
  setTutorOpen(true);
}
