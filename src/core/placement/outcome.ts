/*
 * What a placement session means for the rest of the app (LEARNING-SCIENCE.md B1): where
 * each module asked stands, a level per area built from its modules, an overall level, a
 * starting rating per module, and the concepts the course may assume.
 */

import {
  checkedAreas,
  moduleStateOf,
  plannedModules,
  type ModuleState,
  type PlacementAreaSpec,
  type PlacementScope,
  type PlacementSession,
} from './session';

/** An area is placed at 0 New, 1 Foundations, 2 Working or 3 Advanced. */
export const AREA_LEVELS = 3;

/**
 * B5 rates items `800 + 200 * d` for difficulty 1 to 5. A level maps to the difficulty a
 * learner there answers about three times in four: new starts at the easiest items,
 * Foundations a step up, Working and Advanced near the top. A module the learner missed an
 * item in starts a step lower, so a gap is not buried under easy wins.
 */
const ITEM_RATING_BASE = 800;
const ITEM_RATING_STEP = 200;
const DIFFICULTY_BY_LEVEL = [1, 2, 4, 5] as const;

export function thetaForLevel(level: number, missedInModule = false): number {
  const index = Math.min(AREA_LEVELS, Math.max(0, level));
  const d = Math.max(1, DIFFICULTY_BY_LEVEL[index]! - (missedInModule ? 1 : 0));
  return ITEM_RATING_BASE + ITEM_RATING_STEP * d;
}

/** A module's starting rating: a gap at the bottom, known at Working, strong at the top. */
const THETA_BY_STATE: Readonly<Record<ModuleState, number>> = {
  gap: thetaForLevel(0, true),
  known: thetaForLevel(2),
  strong: thetaForLevel(3),
};

/**
 * An area's level from its modules. Advanced: three in four hold and half are strong.
 * Working: half hold. Foundations: at least one holds. A level stands on several modules
 * this way, never on one answer.
 */
export function areaLevelOf(states: readonly ModuleState[]): number {
  if (states.length === 0) return 0;
  const holds = states.filter((s) => s !== 'gap').length / states.length;
  const strong = states.filter((s) => s === 'strong').length / states.length;
  if (holds >= 0.75 && strong >= 0.5) return 3;
  if (holds >= 0.5) return 2;
  return holds > 0 ? 1 : 0;
}

export interface ModuleResult {
  readonly areaId: string;
  readonly moduleId: string;
  readonly state: ModuleState;
  /** Right answers not marked as a guess, out of `asked`. */
  readonly right: number;
  readonly asked: number;
  /** Misses the learner was certain of: the surest sign of a misconception. */
  readonly sureButWrong: number;
}

export interface PlacementOutcome {
  readonly scope: PlacementScope;
  /** The areas the session asked about, in course order. */
  readonly checked: readonly string[];
  /** Every module settled, in the order asked. */
  readonly modules: readonly ModuleResult[];
  /** 0 to 3, for the checked areas only: an area not picked keeps its earlier result. */
  readonly levelByArea: Readonly<Record<string, number>>;
  /** Only the modules asked: the rest keep whatever rating they had. */
  readonly thetaByModule: Readonly<Record<string, number>>;
  /** The lessons of the questions shown, less any concept answered wrong elsewhere. */
  readonly assumedConcepts: readonly string[];
  /** The other lessons of the questions in modules asked, so an earlier result is undone. */
  readonly unassumedConcepts: readonly string[];
}

const shown = (a: { correct: boolean; confidence: string }) =>
  a.correct && a.confidence !== 'guess';

function moduleResults(session: PlacementSession, areas: readonly PlacementAreaSpec[]) {
  return plannedModules(session, areas).flatMap((planned): ModuleResult[] => {
    const state = moduleStateOf(session, areas, planned.moduleId);
    if (state === undefined) return [];
    const answers = session.answers.filter((a) => a.moduleId === planned.moduleId);
    return [
      {
        areaId: planned.areaId,
        moduleId: planned.moduleId,
        state,
        right: answers.filter(shown).length,
        asked: answers.length,
        sureButWrong: answers.filter((a) => !a.correct && a.confidence === 'certain').length,
      },
    ];
  });
}

export function placementOutcome(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): PlacementOutcome {
  const checked = checkedAreas(session, areas);
  const modules = moduleResults(session, areas);
  const assumesOf = new Map(
    areas.flatMap((a) => a.modules).flatMap((m) => Object.entries(m.assumes ?? {})),
  );

  const levelByArea: Record<string, number> = {};
  for (const area of checked) {
    levelByArea[area.id] = areaLevelOf(
      modules.filter((m) => m.areaId === area.id).map((m) => m.state),
    );
  }
  const thetaByModule = Object.fromEntries(
    modules.map((m) => [m.moduleId, THETA_BY_STATE[m.state]]),
  );

  const missed = new Set(
    session.answers.filter((a) => !shown(a)).flatMap((a) => assumesOf.get(a.itemId) ?? []),
  );
  const assumed = new Set(
    session.answers.filter(shown).flatMap((a) => assumesOf.get(a.itemId) ?? []),
  );
  // A concept both shown and missed is not assumed: the miss is the newer, sharper signal.
  for (const concept of missed) assumed.delete(concept);
  const asked = new Set(modules.map((m) => m.moduleId));
  const unassumed = areas
    .flatMap((a) => a.modules)
    .filter((m) => asked.has(m.id))
    .flatMap((m) => Object.values(m.assumes ?? {}).flat())
    .filter((c) => !assumed.has(c));

  return {
    scope: session.scope,
    checked: checked.map((a) => a.id),
    modules,
    levelByArea,
    thetaByModule,
    assumedConcepts: [...assumed],
    unassumedConcepts: [...new Set(unassumed)],
  };
}

/**
 * What the result says about one area, in words a learner can act on: solid at Advanced,
 * mostly there at Working, worth going deeper below that.
 */
export type AreaVerdict = 'solid' | 'mostly' | 'deeper';

export interface AreaReport {
  readonly areaId: string;
  readonly level: number;
  readonly verdict: AreaVerdict;
  readonly right: number;
  readonly asked: number;
  readonly sureButWrong: number;
  readonly modules: readonly ModuleResult[];
  /** How much of the area was measured: a quick check asks some modules only. */
  readonly modulesAsked: number;
  readonly modulesTotal: number;
}

export function verdictFor(level: number): AreaVerdict {
  return level >= AREA_LEVELS ? 'solid' : level === AREA_LEVELS - 1 ? 'mostly' : 'deeper';
}

/** One report per checked area, in course order. */
export function areaReports(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): AreaReport[] {
  const outcome = placementOutcome(session, areas);
  return checkedAreas(session, areas).map((area) => {
    const modules = outcome.modules.filter((m) => m.areaId === area.id);
    const level = outcome.levelByArea[area.id] ?? 0;
    const sum = (key: 'right' | 'asked' | 'sureButWrong') =>
      modules.reduce((n, m) => n + m[key], 0);
    return {
      areaId: area.id,
      level,
      verdict: verdictFor(level),
      right: sum('right'),
      asked: sum('asked'),
      sureButWrong: sum('sureButWrong'),
      modules,
      modulesAsked: modules.length,
      modulesTotal: area.modules.length,
    };
  });
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

/**
 * The area to work on next: the first checked area in course order below Working; when
 * all are at Working or above, the weakest not yet Advanced. Undefined when all are.
 */
export function focusArea(
  checked: readonly string[],
  levelByArea: Readonly<Record<string, number>>,
): string | undefined {
  const level = (id: string) => levelByArea[id] ?? 0;
  const below = checked.find((id) => level(id) < WORKING);
  if (below) return below;
  return checked
    .filter((id) => level(id) < AREA_LEVELS)
    .reduce<string | undefined>(
      (weakest, id) => (weakest === undefined || level(id) < level(weakest) ? id : weakest),
      undefined,
    );
}
