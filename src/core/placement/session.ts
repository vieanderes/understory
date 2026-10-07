/*
 * One placement session (LEARNING-SCIENCE.md B1): the areas the learner chose to check,
 * in course order, each searched on its own with `area.ts`. The session holds only the
 * facts, the ratings and the answers; where each search stands is replayed from them, so
 * undo is dropping the last answer.
 *
 * Nothing is shown between items, so the session holds no feedback.
 */

import { moduleOfConcept } from '@/core/content/placement-schema';
import type { Confidence } from '@/core/progress/events';
import { AREA_LEVELS, startAreaSearch, stepAreaSearch, type AreaSearch } from './area';

export type StartedAs = 'new' | 'ai-builder' | 'experienced';

/**
 * How the learner rates an area before the check. "new" skips it: asking someone about
 * what they say they have never done costs time and tells us nothing. "confident" starts a
 * level higher, so a strong learner is not walked through the basics.
 */
export type AreaRating = 'new' | 'some' | 'confident';

const START_LEVEL: Readonly<Record<Exclude<AreaRating, 'new'>, number>> = {
  some: 1,
  confident: 2,
};

/**
 * The ratings the opening question fills in, by area position in course order. Someone
 * new checks only the first area; someone who builds with AI the first three, where gaps
 * hide under working code; someone experienced checks everything, the first two from the
 * middle. The learner can change any of them.
 */
export function defaultRatings(
  startedAs: StartedAs,
  areaIds: readonly string[],
): Record<string, AreaRating> {
  const rate = (index: number): AreaRating => {
    if (startedAs === 'new') return index === 0 ? 'some' : 'new';
    if (startedAs === 'ai-builder') return index < 3 ? 'some' : 'new';
    return index < 2 ? 'confident' : 'some';
  };
  return Object.fromEntries(areaIds.map((id, index) => [id, rate(index)]));
}

/** The part of a placement area the session needs. Compiled areas fit this shape. */
export interface PlacementAreaSpec {
  readonly id: string;
  readonly modules: readonly string[];
  readonly levels: readonly {
    readonly level: number;
    readonly concepts: readonly string[];
    readonly items: readonly { readonly id: string; readonly concept: string }[];
  }[];
}

export interface PlacementAnswer {
  readonly itemId: string;
  readonly areaId: string;
  readonly level: number;
  readonly concept: string;
  readonly moduleId: string;
  readonly correct: boolean;
  readonly confidence: Confidence;
}

/** "all" checks every area not rated new; an area id checks that one area in depth. */
export type PlacementScope = 'all' | (string & {});

export interface PlacementSession {
  readonly startedAs?: StartedAs;
  /** How many placements this learner finished before. It rotates the items. */
  readonly attempt: number;
  readonly scope: PlacementScope;
  /** Shown answers a level needs: 1 in the quick check, 2 in the check of one area. */
  readonly itemsToPass: number;
  readonly ratings: Readonly<Record<string, AreaRating>>;
  readonly answers: readonly PlacementAnswer[];
}

export interface CurrentPlacementItem {
  readonly id: string;
  readonly areaId: string;
  readonly level: number;
  readonly concept: string;
  readonly moduleId: string;
}

export function startPlacement(input: {
  ratings: Readonly<Record<string, AreaRating>>;
  startedAs?: StartedAs;
  attempt?: number;
  scope?: PlacementScope;
  itemsToPass?: number;
}): PlacementSession {
  return {
    ...(input.startedAs ? { startedAs: input.startedAs } : {}),
    attempt: input.attempt ?? 0,
    scope: input.scope ?? 'all',
    itemsToPass: input.itemsToPass ?? 1,
    ratings: input.ratings,
    answers: [],
  };
}

/** The areas this session checks, in course order. */
export function checkedAreas<A extends PlacementAreaSpec>(
  session: PlacementSession,
  areas: readonly A[],
): A[] {
  if (session.scope !== 'all') return areas.filter((a) => a.id === session.scope);
  return areas.filter((a) => (session.ratings[a.id] ?? 'new') !== 'new');
}

function startLevel(session: PlacementSession, areaId: string): number {
  const rating = session.ratings[areaId] ?? 'some';
  // Asking for one area is itself a rating of at least "some".
  return START_LEVEL[rating === 'new' ? 'some' : rating];
}

/** Where the search of one area stands after the answers given in it. */
export function areaSearchOf(session: PlacementSession, areaId: string): AreaSearch {
  let search = startAreaSearch(startLevel(session, areaId), session.itemsToPass);
  for (const a of session.answers) {
    if (a.areaId !== areaId) continue;
    search = stepAreaSearch(search, a.correct && a.confidence !== 'guess');
  }
  return search;
}

/**
 * The item an area would ask next, or null when its search is over. Items at a level are
 * taken in turn from an offset that moves with each attempt. A level with no unseen item
 * left ends the area: showing an item twice would measure memory of it, not skill.
 */
function nextItemIn(
  session: PlacementSession,
  area: PlacementAreaSpec,
): CurrentPlacementItem | null {
  const search = areaSearchOf(session, area.id);
  if (search.done) return null;
  const level = area.levels.find((l) => l.level === search.level);
  if (!level || level.items.length === 0) return null;
  const visits = session.answers.filter(
    (a) => a.areaId === area.id && a.level === level.level,
  ).length;
  if (visits >= level.items.length) return null;
  const item = level.items[(session.attempt + visits) % level.items.length];
  /* v8 ignore next -- the index is always in range after the length checks above */
  if (!item) return null;
  return {
    id: item.id,
    areaId: area.id,
    level: level.level,
    concept: item.concept,
    moduleId: moduleOfConcept(item.concept),
  };
}

/** The item to show now, or null when the session is over. */
export function currentPlacementItem(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): CurrentPlacementItem | null {
  for (const area of checkedAreas(session, areas)) {
    const item = nextItemIn(session, area);
    if (item) return item;
  }
  return null;
}

/** Records one answer. An answer to anything but the current item changes nothing. */
export function answerPlacement(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
  answer: { readonly itemId: string; readonly correct: boolean; readonly confidence: Confidence },
): PlacementSession {
  const item = currentPlacementItem(session, areas);
  if (!item || item.id !== answer.itemId) return session;
  return {
    ...session,
    answers: [
      ...session.answers,
      {
        itemId: item.id,
        areaId: item.areaId,
        level: item.level,
        concept: item.concept,
        moduleId: item.moduleId,
        correct: answer.correct,
        confidence: answer.confidence,
      },
    ],
  };
}

/**
 * Takes back the last answer. The answer event already recorded stays in the log as a
 * fact; the result is built from the session, which no longer has it.
 */
export function undoPlacement(session: PlacementSession): PlacementSession {
  if (session.answers.length === 0) return session;
  return { ...session, answers: session.answers.slice(0, -1) };
}

export interface PlacementProgress {
  /** The area under way, 0-based; equal to `areaCount` once every area is settled. */
  readonly areaIndex: number;
  readonly areaCount: number;
  readonly asked: number;
  /** The most items the session can still ask in total, for a "3 / 24" ceiling. */
  readonly maxItems: number;
}

export function placementProgress(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): PlacementProgress {
  const checked = checkedAreas(session, areas);
  const current = currentPlacementItem(session, areas);
  const index = current ? checked.findIndex((a) => a.id === current.areaId) : checked.length;
  return {
    areaIndex: index,
    areaCount: checked.length,
    asked: session.answers.length,
    maxItems: checked.length * AREA_LEVELS * session.itemsToPass,
  };
}
