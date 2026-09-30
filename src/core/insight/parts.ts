import type { MasteryState } from '../mastery';
import type { ProgressState } from '../progress';

/*
 * Progress through the parts of the course (LEARNING-SCIENCE.md, C, "Parts and
 * milestones"). A part is a proximal goal: a few chapters with a visible end. Everything
 * here is derived from the event log and the clock, never stored, so a finished part is a
 * fact about the log and a milestone cannot be awarded twice by a sync merge.
 */

/** A part as the content index describes it: published lessons and concepts, in journey order. */
export interface PartIndex {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly modules: readonly string[];
  readonly lessons: readonly string[];
  readonly concepts: readonly string[];
}

/** The mastery state of a concept at the moment of looking. */
export type ConceptStateOf = (conceptId: string) => MasteryState;

export interface PartProgress {
  readonly id: string;
  readonly lessonsDone: number;
  readonly lessonsTotal: number;
  /** 0..1. What the progress line shows. */
  readonly lessonShare: number;
  readonly conceptsSolid: number;
  readonly conceptsTotal: number;
  /** 0..1. */
  readonly conceptShare: number;
  /** A test-out of the whole part was passed. */
  readonly testedOut: boolean;
  /** Every published lesson is done or tested out. A part with none is never complete. */
  readonly complete: boolean;
  readonly capstoneBuilt: boolean;
}

const HELD: ReadonlySet<MasteryState> = new Set(['solid', 'fluent']);

const share = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

/** A passed test-out is recorded under the id of the module or the part it covered. */
const passedTestOut = (state: ProgressState, id: string): boolean =>
  (state.testOuts[id] ?? []).some((attempt) => attempt.passed);

/** A lesson id starts with its module id (`js.closures`), which the validator enforces. */
const moduleOfLesson = (lessonId: string): string => lessonId.split('.')[0] ?? '';

export function partProgress(
  part: PartIndex,
  state: ProgressState,
  stateOf: ConceptStateOf,
): PartProgress {
  const testedOut = passedTestOut(state, part.id);
  const lessonsDone = part.lessons.filter(
    (id) => testedOut || state.completedLessons.has(id) || passedTestOut(state, moduleOfLesson(id)),
  ).length;
  const conceptsSolid = part.concepts.filter((id) => HELD.has(stateOf(id))).length;
  const lessonsTotal = part.lessons.length;
  return {
    id: part.id,
    lessonsDone,
    lessonsTotal,
    lessonShare: share(lessonsDone, lessonsTotal),
    conceptsSolid,
    conceptsTotal: part.concepts.length,
    conceptShare: share(conceptsSolid, part.concepts.length),
    testedOut,
    complete: lessonsTotal > 0 && lessonsDone === lessonsTotal,
    capstoneBuilt: state.completedCapstones.has(part.id),
  };
}

export interface JourneyProgress {
  /** In course order. */
  readonly parts: readonly PartProgress[];
  /** The first part with lessons that is not complete, or null once all are. */
  readonly current: PartProgress | null;
  /**
   * The latest complete part whose concepts are not all Solid yet. Its checkpoint is a
   * mixed review of the whole part, offered once its lessons are done.
   */
  readonly checkpoint: PartProgress | null;
}

export function journeyProgress(
  parts: readonly PartIndex[],
  state: ProgressState,
  stateOf: ConceptStateOf,
): JourneyProgress {
  const progress = parts.map((part) => partProgress(part, state, stateOf));
  const current = progress.find((p) => p.lessonsTotal > 0 && !p.complete) ?? null;
  const checkpoint =
    progress.filter((p) => p.complete && p.conceptsSolid < p.conceptsTotal).at(-1) ?? null;
  return { parts: progress, current, checkpoint };
}

/** The part a lesson counts towards, woven lessons included. */
export function partOfLesson<P extends PartIndex>(
  parts: readonly P[],
  lessonId: string,
): P | undefined {
  return parts.find((part) => part.lessons.includes(lessonId));
}
