/*
 * One placement session (LEARNING-SCIENCE.md B1): the areas the learner picked, measured
 * module by module with the same fixed questions for everyone. The modules of the picked
 * areas take turns, so the topics mix. The session holds only the facts, the picks and
 * the answers; where each module stands is replayed from them, so undo is dropping the
 * last answer.
 */

import type { Confidence } from '@/core/progress/events';

/**
 * How long the learner wants to spend. Quick asks two modules an area, balanced every
 * module, thorough every module with a second core question to confirm the first.
 */
export type PlacementMode = 'quick' | 'balanced' | 'thorough';

export type ItemRole = 'core' | 'deep';

/**
 * Where a module stands. A gap: the core question was missed. Known: the core holds, the
 * deep question did not. Strong: the deep question holds too.
 */
export type ModuleState = 'gap' | 'known' | 'strong';

export interface PlacementItemRef {
  readonly id: string;
  readonly concept: string;
  readonly also?: readonly string[] | undefined;
}

/** The part of a placement area the session needs. Compiled areas fit this shape. */
export interface PlacementAreaSpec {
  readonly id: string;
  readonly quick: readonly string[];
  readonly modules: readonly {
    readonly id: string;
    readonly core: readonly PlacementItemRef[];
    readonly deep: readonly PlacementItemRef[];
    /** What a right answer to each item lets the course assume, by item id. */
    readonly assumes?: Readonly<Record<string, readonly string[]>>;
  }[];
}

type ModuleSpec = PlacementAreaSpec['modules'][number];

export interface PlacementAnswer {
  readonly itemId: string;
  readonly areaId: string;
  readonly moduleId: string;
  readonly role: ItemRole;
  readonly correct: boolean;
  readonly confidence: Confidence;
}

/** "all" for a check the learner composed; an area id for the check of that one area. */
export type PlacementScope = 'all' | (string & {});

export interface PlacementSession {
  readonly mode: PlacementMode;
  readonly scope: PlacementScope;
  /** The picked areas. Their order does not matter: the session follows the course. */
  readonly areas: readonly string[];
  readonly answers: readonly PlacementAnswer[];
}

export interface CurrentPlacementItem {
  readonly id: string;
  readonly areaId: string;
  readonly moduleId: string;
  readonly role: ItemRole;
}

export function startPlacement(input: {
  areas: readonly string[];
  mode: PlacementMode;
  scope?: PlacementScope;
}): PlacementSession {
  return { mode: input.mode, scope: input.scope ?? 'all', areas: input.areas, answers: [] };
}

/** The picked areas, in course order. */
export function checkedAreas<A extends PlacementAreaSpec>(
  session: PlacementSession,
  areas: readonly A[],
): A[] {
  return areas.filter((a) => session.areas.includes(a.id));
}

export interface PlannedModule {
  readonly areaId: string;
  readonly moduleId: string;
}

/**
 * Every module the session will ask, in the order it asks them: the first module of each
 * picked area, then the second of each, and so on. Fixed for a given pick, so everyone who
 * picks the same meets the same questions in the same order.
 */
export function plannedModules(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): PlannedModule[] {
  const lists = checkedAreas(session, areas).map((area) =>
    (session.mode === 'quick'
      ? area.modules.filter((m) => area.quick.includes(m.id))
      : area.modules
    ).map((m) => ({ areaId: area.id, moduleId: m.id })),
  );
  const longest = Math.max(0, ...lists.map((l) => l.length));
  const planned: PlannedModule[] = [];
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) {
      const entry = list[i];
      if (entry) planned.push(entry);
    }
  }
  return planned;
}

/** A right answer the learner did not mark as a guess: a lucky pick is evidence of nothing. */
const shown = (a: PlacementAnswer) => a.correct && a.confidence !== 'guess';

const coreNeeded = (mode: PlacementMode) => (mode === 'thorough' ? 2 : 1);

interface ModuleStep {
  readonly next: { readonly item: PlacementItemRef; readonly role: ItemRole } | null;
  readonly state: ModuleState | undefined;
}

/**
 * Replays one module's answers. Core questions first; a miss is a gap. Then the first deep
 * question; a miss leaves the module known. A deep answer that was not certain is
 * confirmed by the second deep question, and the thorough check always asks both, so
 * "strong" never rests on one lucky pick.
 */
function stepModule(session: PlacementSession, spec: ModuleSpec): ModuleStep {
  const answers = session.answers.filter((a) => a.moduleId === spec.id);
  const need = coreNeeded(session.mode);
  for (let i = 0; i < need; i += 1) {
    const a = answers[i];
    const item = spec.core[i];
    if (!a) return item ? { next: { item, role: 'core' }, state: undefined } : end('known');
    if (!shown(a)) return end('gap');
  }
  const first = answers[need];
  const deep = spec.deep[0];
  if (!first) return deep ? { next: { item: deep, role: 'deep' }, state: undefined } : end('known');
  if (!shown(first)) return end('known');
  if (session.mode !== 'thorough' && first.confidence === 'certain') return end('strong');
  const second = answers[need + 1];
  const confirm = spec.deep[1];
  if (!second) {
    return confirm ? { next: { item: confirm, role: 'deep' }, state: undefined } : end('strong');
  }
  return end(shown(second) ? 'strong' : 'known');
}

const end = (state: ModuleState): ModuleStep => ({ next: null, state });

function findModule(areas: readonly PlacementAreaSpec[], moduleId: string) {
  for (const area of areas) {
    const spec = area.modules.find((m) => m.id === moduleId);
    if (spec) return spec;
  }
  return undefined;
}

/** Where a module stands, or undefined while it is not settled. */
export function moduleStateOf(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
  moduleId: string,
): ModuleState | undefined {
  const spec = findModule(areas, moduleId);
  if (!spec || !session.answers.some((a) => a.moduleId === moduleId)) return undefined;
  return stepModule(session, spec).state;
}

/** The item to show now, or null when the session is over. */
export function currentPlacementItem(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): CurrentPlacementItem | null {
  for (const planned of plannedModules(session, areas)) {
    const spec = findModule(areas, planned.moduleId);
    const next = spec ? stepModule(session, spec).next : null;
    if (next) {
      return {
        id: next.item.id,
        areaId: planned.areaId,
        moduleId: planned.moduleId,
        role: next.role,
      };
    }
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
        moduleId: item.moduleId,
        role: item.role,
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

/** The most questions one module can ask: its core questions and both deep ones. */
const moduleCeiling = (mode: PlacementMode) => coreNeeded(mode) + 2;

/** How long a fresh session can run: one question a module at least. */
export function placementLength(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): { readonly fewest: number; readonly most: number } {
  const modules = plannedModules(session, areas).length;
  return { fewest: modules, most: modules * moduleCeiling(session.mode) };
}

export interface PlacementProgress {
  readonly asked: number;
  /** The most items the session can ask in all. It falls as modules settle early. */
  readonly maxItems: number;
}

export function placementProgress(
  session: PlacementSession,
  areas: readonly PlacementAreaSpec[],
): PlacementProgress {
  const asked = session.answers.length;
  const left = plannedModules(session, areas).reduce((sum, planned) => {
    const spec = findModule(areas, planned.moduleId);
    if (!spec || stepModule(session, spec).next === null) return sum;
    const inModule = session.answers.filter((a) => a.moduleId === planned.moduleId).length;
    return sum + moduleCeiling(session.mode) - inModule;
  }, 0);
  return { asked, maxItems: asked + left };
}
