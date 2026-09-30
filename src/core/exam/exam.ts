import type { CatalogSkillItem } from '@/core/practice/catalog';
import { TEST_OUT_MINUTES, TEST_OUT_PASS_SHARE, testOutPassed } from '@/core/practice/checkpoint';
import {
  excludesTyping,
  sessionSize,
  skillCardKey,
  type DeviceKind,
  type SessionItem,
  type SessionMinutes,
} from '@/core/practice/session';
import { mulberry32, shuffle } from '@/core/util/rng';

/*
 * A path's final exam (LEARNING-SCIENCE.md, C, "Learning paths, the final exam and the
 * certificate"). The same items and the same length as a test-out, drawn from the path's
 * required lessons only, spread evenly across its stages and across the lessons inside each
 * stage. Unlike a checkpoint it does not lean on what the learner finds weak: two learners
 * with the same seed sit the same exam, whatever their history.
 */

/** B5's boss set length, as for a test-out. */
export const PATH_EXAM_MINUTES: SessionMinutes = TEST_OUT_MINUTES;

/** B5: "Passing at 80% or more". */
export const PATH_EXAM_PASS_SHARE = TEST_OUT_PASS_SHARE;

export function pathExamPassed(right: number, total: number): boolean {
  return testOutPassed(right, total);
}

/**
 * Steps graded by the learner's own judgement. They teach well, but a score that has to mean
 * something to someone else is built only from answers the app checks.
 */
const SELF_GRADED = new Set(['explain-back']);

export interface ExamStage {
  readonly title: string;
  /** The stage's required lessons, in path order. */
  readonly lessonIds: readonly string[];
}

export interface ExamItem extends SessionItem {
  readonly lessonId: string;
  /** Index into the path's stages. */
  readonly stage: number;
}

export interface BuildPathExamInput {
  readonly catalog: { readonly skillItems: readonly CatalogSkillItem[] };
  readonly stages: readonly ExamStage[];
  readonly device: DeviceKind;
  readonly seed: number;
  readonly minutes?: SessionMinutes;
}

/** Takes one item from each queue in turn until `count` are taken or every queue is empty. */
function roundRobin<T>(queues: readonly (readonly T[])[], count: number): T[] {
  const out: T[] = [];
  for (let round = 0; out.length < count && queues.some((q) => q.length > round); round++) {
    for (const queue of queues) {
      const next = queue[round];
      if (next !== undefined && out.length < count) out.push(next);
    }
  }
  return out;
}

export function buildPathExam(input: BuildPathExamInput): ExamItem[] {
  const { catalog, stages, device } = input;
  const size = sessionSize(input.minutes ?? PATH_EXAM_MINUTES);
  const rng = mulberry32(input.seed);

  const eligible = catalog.skillItems.filter(
    (item) => !SELF_GRADED.has(item.type) && !excludesTyping(device, item.type),
  );
  const seen = new Set<string>();

  // Per stage, per lesson: that lesson's items in a seeded order. Lessons stay in path order.
  const pools = stages.map((stage, stageIndex) =>
    stage.lessonIds.map((lessonId) =>
      shuffle(
        eligible.filter((item) => item.lessonId === lessonId),
        rng,
      )
        .filter((item) => {
          const key = skillCardKey(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item): ExamItem => ({
          source: 'interleave',
          cardKey: skillCardKey(item),
          concept: item.concept,
          lessonId: item.lessonId,
          stage: stageIndex,
        })),
    ),
  );

  // A fair spread: every stage gets one more seat in turn, until the exam is full or a stage
  // has nothing left to give, so a thin stage gives what it has and the rest move on.
  const quotas = pools.map((lessons) => ({
    lessons,
    available: lessons.reduce((sum, l) => sum + l.length, 0),
    seats: 0,
  }));
  let filled = 0;
  while (filled < size && quotas.some((q) => q.seats < q.available)) {
    for (const quota of quotas) {
      if (filled < size && quota.seats < quota.available) {
        quota.seats += 1;
        filled += 1;
      }
    }
  }

  // Inside a stage, the lessons take turns, so one long lesson cannot crowd out the rest.
  const perStage = quotas.map((q) => roundRobin(q.lessons, q.seats));
  // Across stages, the exam alternates, so it reads as a mixed review of the whole path.
  return roundRobin(perStage, size);
}

export interface ExamStageResult {
  readonly title: string;
  readonly right: number;
  readonly total: number;
  /** Below the pass share. A stage the exam did not reach is not weak. */
  readonly weak: boolean;
  /** Lessons with at least one wrong answer, in path order. */
  readonly missedLessonIds: readonly string[];
}

/**
 * How each stage went. `outcomes[i]` is item i's answer: true right, false wrong, and null or
 * missing when it was skipped or not reached, which then counts neither way.
 */
export function examStageResults(
  items: readonly ExamItem[],
  outcomes: readonly (boolean | null | undefined)[],
  stages: readonly ExamStage[],
): ExamStageResult[] {
  return stages.map((stage, stageIndex) => {
    const answered = items
      .map((item, i) => ({ item, outcome: outcomes[i] }))
      .filter(
        (a): a is { item: ExamItem; outcome: boolean } =>
          a.item.stage === stageIndex && typeof a.outcome === 'boolean',
      );
    const right = answered.filter((a) => a.outcome).length;
    const missed = new Set(answered.filter((a) => !a.outcome).map((a) => a.item.lessonId));
    return {
      title: stage.title,
      right,
      total: answered.length,
      weak: answered.length > 0 && right / answered.length < PATH_EXAM_PASS_SHARE,
      missedLessonIds: stage.lessonIds.filter((id) => missed.has(id)),
    };
  });
}
