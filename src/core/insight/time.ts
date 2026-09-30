import { CHECKPOINT_MINUTES } from '../practice/checkpoint';
import type { ProgressState } from '../progress';
import { partProgress, type ConceptStateOf, type PartIndex, type PartProgress } from './parts';

/*
 * Time estimates: what a lesson, a module, a part and the whole journey take, and how much
 * of it is left. A lesson's time is its author's estimate (`minutes`), a checkpoint's is
 * its fixed session length, and a sum of estimates is an estimate, so the screens say
 * "about" in front of every total.
 */

export interface TimeTotal {
  /** Minutes, everything counted. */
  readonly total: number;
  /** Minutes not yet done. */
  readonly left: number;
  /** Lessons counted. A checkpoint adds time, not a lesson. */
  readonly count: number;
  readonly countLeft: number;
}

const NONE: TimeTotal = { total: 0, left: 0, count: 0, countLeft: 0 };

/** Above ten hours the minutes are noise in an estimate, so only hours are shown. */
const HOURS_ONLY_FROM = 600;

/** `45 min`, `1 h 20 min`, `71 h`. */
export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  if (whole >= HOURS_ONLY_FROM) return `${Math.round(whole / 60)} h`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function sumTime(
  lessons: readonly { readonly id: string; readonly minutes: number }[],
  isDone: (lessonId: string) => boolean,
): TimeTotal {
  const left = lessons.filter((lesson) => !isDone(lesson.id));
  return {
    total: lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
    left: left.reduce((sum, lesson) => sum + lesson.minutes, 0),
    count: lessons.length,
    countLeft: left.length,
  };
}

export function addTime(...totals: readonly TimeTotal[]): TimeTotal {
  return totals.reduce(
    (sum, t) => ({
      total: sum.total + t.total,
      left: sum.left + t.left,
      count: sum.count + t.count,
      countLeft: sum.countLeft + t.countLeft,
    }),
    NONE,
  );
}

/**
 * Done means completed or tested out, the same rule as part progress: a passed test-out
 * is recorded under a module id or a part id.
 */
export function isLessonDone(
  state: ProgressState,
  parts: readonly PartIndex[],
): (lessonId: string) => boolean {
  const passed = (id: string) => (state.testOuts[id] ?? []).some((attempt) => attempt.passed);
  const testedOutParts = parts.filter((part) => passed(part.id));
  return (lessonId) =>
    state.completedLessons.has(lessonId) ||
    passed(lessonId.split('.')[0] ?? '') ||
    testedOutParts.some((part) => part.lessons.includes(lessonId));
}

/** A part's checkpoint: one session, counted as left while the checkpoint is still offered. */
export function checkpointTime(progress: PartProgress): TimeTotal {
  if (progress.lessonsTotal === 0) return NONE;
  const held = progress.complete && progress.conceptsSolid === progress.conceptsTotal;
  return { total: CHECKPOINT_MINUTES, left: held ? 0 : CHECKPOINT_MINUTES, count: 0, countLeft: 0 };
}

export interface JourneyTimeInput {
  /** Every published lesson of the course, woven ones included. */
  readonly lessons: readonly { readonly id: string; readonly minutes: number }[];
  readonly parts: readonly PartIndex[];
  readonly state: ProgressState;
  readonly stateOf: ConceptStateOf;
}

export interface JourneyTime {
  readonly journey: TimeTotal;
  /** Part id to its lessons and its checkpoint. */
  readonly parts: Readonly<Record<string, TimeTotal>>;
}

export function journeyTime(input: JourneyTimeInput): JourneyTime {
  const isDone = isLessonDone(input.state, input.parts);
  const minutesOf = new Map(input.lessons.map((lesson) => [lesson.id, lesson.minutes]));
  const parts = Object.fromEntries(
    input.parts.map((part) => {
      const lessons = part.lessons.map((id) => ({ id, minutes: minutesOf.get(id) ?? 0 }));
      const progress = partProgress(part, input.state, input.stateOf);
      return [part.id, addTime(sumTime(lessons, isDone), checkpointTime(progress))];
    }),
  );
  const checkpoints = input.parts.map((part) =>
    checkpointTime(partProgress(part, input.state, input.stateOf)),
  );
  return { journey: addTime(sumTime(input.lessons, isDone), ...checkpoints), parts };
}
