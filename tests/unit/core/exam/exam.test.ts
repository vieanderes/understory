import { describe, expect, it } from 'vitest';
import {
  buildPathExam,
  PATH_EXAM_MINUTES,
  PATH_EXAM_PASS_SHARE,
  pathExamPassed,
  examStageResults,
  type ExamStage,
} from '@/core/exam';
import type { CatalogSkillItem } from '@/core/practice';
import { sessionSize } from '@/core/practice/session';

function items(lessonId: string, count: number, type = 'multiple-choice'): CatalogSkillItem[] {
  return Array.from({ length: count }, (_, i) => ({
    lessonId,
    stepId: `step-${i + 1}`,
    type,
    concept: lessonId,
    difficulty: 2,
  }));
}

const STAGES: ExamStage[] = [
  { title: 'Basics', lessonIds: ['c.one', 'c.two'] },
  { title: 'Middle', lessonIds: ['c.three'] },
  { title: 'End', lessonIds: ['c.four', 'c.five'] },
];

const CATALOG = {
  skillItems: [
    ...items('c.one', 20),
    ...items('c.two', 20),
    ...items('c.three', 20),
    ...items('c.four', 20),
    ...items('c.five', 20),
    ...items('c.elsewhere', 20),
  ],
};

describe('the path exam rules', () => {
  it('sits for 20 minutes and passes at 80%, like a test-out', () => {
    expect(PATH_EXAM_MINUTES).toBe(20);
    expect(PATH_EXAM_PASS_SHARE).toBe(0.8);
  });

  it('passes at 80% or more of a non-empty exam', () => {
    expect(pathExamPassed(8, 10)).toBe(true);
    expect(pathExamPassed(23, 28)).toBe(true);
    expect(pathExamPassed(22, 28)).toBe(false);
    expect(pathExamPassed(0, 0)).toBe(false);
  });
});

describe('buildPathExam', () => {
  it('fills the 20-minute size from the path lessons only', () => {
    const exam = buildPathExam({ catalog: CATALOG, stages: STAGES, device: 'desktop', seed: 1 });
    expect(exam).toHaveLength(sessionSize(20));
    const lessonIds = new Set(STAGES.flatMap((s) => s.lessonIds));
    expect(exam.every((item) => lessonIds.has(item.lessonId))).toBe(true);
    expect(new Set(exam.map((i) => i.cardKey)).size).toBe(exam.length);
  });

  it('spreads the items fairly across stages, whatever their size', () => {
    const exam = buildPathExam({ catalog: CATALOG, stages: STAGES, device: 'desktop', seed: 7 });
    const perStage = [0, 1, 2].map((s) => exam.filter((i) => i.stage === s).length);
    expect(Math.max(...perStage) - Math.min(...perStage)).toBeLessThanOrEqual(1);
  });

  it('spreads a stage across its lessons', () => {
    const exam = buildPathExam({ catalog: CATALOG, stages: STAGES, device: 'desktop', seed: 3 });
    const one = exam.filter((i) => i.lessonId === 'c.one').length;
    const two = exam.filter((i) => i.lessonId === 'c.two').length;
    expect(Math.abs(one - two)).toBeLessThanOrEqual(1);
  });

  it('gives a thin stage all it has and the rest to the others', () => {
    const catalog = {
      skillItems: [...items('c.one', 30), ...items('c.three', 2), ...items('c.four', 30)],
    };
    const exam = buildPathExam({ catalog, stages: STAGES, device: 'desktop', seed: 5 });
    expect(exam).toHaveLength(sessionSize(20));
    expect(exam.filter((i) => i.stage === 1)).toHaveLength(2);
  });

  it('is as long as the path allows when it has fewer items than the size', () => {
    const catalog = { skillItems: [...items('c.one', 3), ...items('c.four', 2)] };
    const exam = buildPathExam({ catalog, stages: STAGES, device: 'desktop', seed: 5 });
    expect(exam).toHaveLength(5);
  });

  it('asks each item once, even when a lesson sits in two stages', () => {
    const stages = [
      { title: 'One', lessonIds: ['c.one'] },
      { title: 'Again', lessonIds: ['c.one'] },
    ];
    const exam = buildPathExam({
      catalog: { skillItems: items('c.one', 3) },
      stages,
      device: 'desktop',
      seed: 1,
    });
    expect(exam).toHaveLength(3);
    expect(new Set(exam.map((i) => i.cardKey)).size).toBe(3);
  });

  it('is empty for a path with no scored items', () => {
    expect(
      buildPathExam({ catalog: { skillItems: [] }, stages: STAGES, device: 'phone', seed: 1 }),
    ).toEqual([]);
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const input = { catalog: CATALOG, stages: STAGES, device: 'desktop' as const };
    const a = buildPathExam({ ...input, seed: 42 });
    expect(buildPathExam({ ...input, seed: 42 })).toEqual(a);
    expect(buildPathExam({ ...input, seed: 43 }).map((i) => i.cardKey)).not.toEqual(
      a.map((i) => i.cardKey),
    );
  });

  it('mixes the stages instead of running them in order', () => {
    const exam = buildPathExam({ catalog: CATALOG, stages: STAGES, device: 'desktop', seed: 9 });
    expect(exam.slice(0, 3).map((i) => i.stage)).toEqual([0, 1, 2]);
  });

  it('leaves out self-graded explain-back steps, and code on a phone', () => {
    const catalog = {
      skillItems: [
        ...items('c.one', 4, 'explain-back'),
        ...items('c.two', 4, 'code-challenge'),
        ...items('c.three', 4),
      ],
    };
    const phone = buildPathExam({ catalog, stages: STAGES, device: 'phone', seed: 2 });
    expect(phone.map((i) => i.lessonId)).toEqual(Array(4).fill('c.three'));
    const desktop = buildPathExam({ catalog, stages: STAGES, device: 'desktop', seed: 2 });
    expect(desktop.filter((i) => i.lessonId === 'c.two')).toHaveLength(4);
    expect(desktop.some((i) => i.lessonId === 'c.one')).toBe(false);
  });

  it('keys each item as a skill card and names its concept', () => {
    const [first] = buildPathExam({
      catalog: { skillItems: items('c.three', 1) },
      stages: STAGES,
      device: 'desktop',
      seed: 1,
    });
    expect(first).toEqual({
      source: 'interleave',
      cardKey: 'skill:c.three#step-1',
      concept: 'c.three',
      lessonId: 'c.three',
      stage: 1,
    });
  });

  it('takes a shorter sitting when asked', () => {
    const exam = buildPathExam({
      catalog: CATALOG,
      stages: STAGES,
      device: 'desktop',
      seed: 1,
      minutes: 5,
    });
    expect(exam).toHaveLength(sessionSize(5));
  });
});

describe('examStageResults', () => {
  const exam = buildPathExam({ catalog: CATALOG, stages: STAGES, device: 'desktop', seed: 11 });

  it('scores each stage and names the lessons behind the misses', () => {
    const outcomes = exam.map((item) => (item.stage === 2 ? item.lessonId !== 'c.four' : true));
    const results = examStageResults(exam, outcomes, STAGES);
    expect(results.map((r) => r.title)).toEqual(['Basics', 'Middle', 'End']);
    expect(results[0]).toMatchObject({ weak: false, missedLessonIds: [] });
    expect(results[0]!.right).toBe(results[0]!.total);
    const end = results[2]!;
    expect(end.weak).toBe(true);
    expect(end.missedLessonIds).toEqual(['c.four']);
    expect(end.right).toBe(exam.filter((i) => i.lessonId === 'c.five').length);
  });

  it('keeps the missed lessons in path order, once each', () => {
    const outcomes = exam.map(() => false);
    const [basics] = examStageResults(exam, outcomes, STAGES);
    expect(basics!.missedLessonIds).toEqual(['c.one', 'c.two']);
  });

  it('counts an unanswered item as neither right nor wrong', () => {
    const results = examStageResults(exam, [true], STAGES);
    const total = results.reduce((sum, r) => sum + r.total, 0);
    expect(total).toBe(1);
  });

  it('marks a stage the exam did not reach as not weak', () => {
    const results = examStageResults([], [], STAGES);
    expect(results.every((r) => r.total === 0 && !r.weak)).toBe(true);
  });
});
