/*
 * What a placement session means for the rest of the app (LEARNING-SCIENCE.md B1): a level
 * per area, an overall level, a starting rating per module, and the concepts the course
 * may assume.
 */

import { AREA_LEVELS, areaLevel } from './area';
import {
  areaSearchOf,
  checkedAreas,
  type AreaRating,
  type PlacementAreaSpec,
  type PlacementScope,
  type PlacementSession,
} from './session';

/**
 * B5 rates items `800 + 200 * d` for difficulty 1 to 5. An area level maps to the
 * difficulty a learner there answers about three times in four: new to an area starts at
 * the easiest items, Foundations a step up, Working and Advanced near the top. A module the
 * learner missed an item in starts a step lower, so a gap is not buried under easy wins.
 */
const ITEM_RATING_BASE = 800;
const ITEM_RATING_STEP = 200;
const DIFFICULTY_BY_LEVEL = [1, 2, 4, 5] as const;

export function thetaForLevel(level: number, missedInModule = false): number {
  const index = Math.min(AREA_LEVELS, Math.max(0, level));
  const d = Math.max(1, DIFFICULTY_BY_LEVEL[index]! - (missedInModule ? 1 : 0));
  return ITEM_RATING_BASE + ITEM_RATING_STEP * d;
}

export interface PlacementOutcome {
  readonly scope: PlacementScope;
  /** The areas the session asked about, in course order. */
  readonly checked: readonly string[];
  /** 0 to 3 per area. A quick check also places areas rated new, at 0. */
  readonly levelByArea: Readonly<Record<string, number>>;
  /** Only the modules of checked areas: a new area keeps whatever rating it had. */
  readonly thetaByModule: Readonly<Record<string, number>>;
  /** B1: concepts of the levels passed, except any answered wrong and never right. */
  readonly assumedConcepts: readonly string[];
  /** Concepts of checked areas the session did not show, so an earlier result is undone. */
  readonly unassumedConcepts: readonly string[];
}

export function placementOutcome(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): PlacementOutcome {
  const checked = checkedAreas(session, areas);
  const missed = new Set(
    session.answers
      .filter((a) => !a.correct)
      .map((a) => a.concept)
      .filter((concept) => !session.answers.some((a) => a.correct && a.concept === concept)),
  );
  const missedModules = new Set(session.answers.filter((a) => !a.correct).map((a) => a.moduleId));

  const levelByArea: Record<string, number> = {};
  if (session.scope === 'all') for (const area of areas) levelByArea[area.id] = 0;
  const thetaByModule: Record<string, number> = {};
  const assumed: string[] = [];
  const unassumed: string[] = [];

  for (const area of checked) {
    const level = areaLevel(areaSearchOf(session, area.id));
    levelByArea[area.id] = level;
    for (const moduleId of area.modules) {
      thetaByModule[moduleId] = thetaForLevel(level, missedModules.has(moduleId));
    }
    for (const l of area.levels) {
      for (const concept of l.concepts) {
        if (l.level <= level && !missed.has(concept)) assumed.push(concept);
        else unassumed.push(concept);
      }
    }
  }

  return {
    scope: session.scope,
    checked: checked.map((a) => a.id),
    levelByArea,
    thetaByModule,
    assumedConcepts: [...new Set(assumed)],
    unassumedConcepts: [...new Set(unassumed)],
  };
}

export type OverallStage = 'starting' | 'building' | 'working' | 'strong';

export interface OverallLevel {
  readonly score: number;
  readonly max: number;
  readonly stage: OverallStage;
}

/** The whole course in one figure: the area levels added up, an area not placed counting 0. */
export function overallLevel(
  levelByArea: Readonly<Record<string, number>>,
  areaIds: readonly string[],
): OverallLevel {
  const score = areaIds.reduce((sum, id) => sum + (levelByArea[id] ?? 0), 0);
  const max = areaIds.length * AREA_LEVELS;
  const share = max === 0 ? 0 : score / max;
  const stage: OverallStage =
    share < 0.25 ? 'starting' : share < 0.5 ? 'building' : share < 0.75 ? 'working' : 'strong';
  return { score, max, stage };
}

/** Below this an area is where the learner should work next. */
const WORKING = 2;
/** The first areas are what the rest build on, so they count whatever the rating. */
const FOUNDATION_AREAS = 2;

/**
 * The area to work on next: the first in course order below Working, among the areas the
 * learner cares about (any not rated new, plus the foundations). When all of those are at
 * Working, the weakest one not yet Advanced. Undefined when everything is Advanced.
 */
export function focusArea(
  areaIds: readonly string[],
  levelByArea: Readonly<Record<string, number>>,
  ratings: Readonly<Record<string, AreaRating>>,
): string | undefined {
  const considered = areaIds.filter(
    (id, index) => index < FOUNDATION_AREAS || (ratings[id] ?? 'new') !== 'new',
  );
  const level = (id: string) => levelByArea[id] ?? 0;
  const below = considered.find((id) => level(id) < WORKING);
  if (below) return below;
  const open = considered.filter((id) => level(id) < AREA_LEVELS);
  return open.reduce<string | undefined>(
    (weakest, id) => (weakest === undefined || level(id) < level(weakest) ? id : weakest),
    undefined,
  );
}
