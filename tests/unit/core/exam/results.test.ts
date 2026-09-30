import { describe, expect, it } from 'vitest';
import { pathExamResult } from '@/core/exam';
import type { PathExamAttempt } from '@/core/progress';

function attempt(right: number, total: number, day: number): PathExamAttempt {
  const finishedAt = `2026-09-${String(day).padStart(2, '0')}T10:20:00.000Z`;
  return {
    seed: day,
    right,
    total,
    startedAt: `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    finishedAt,
    lessonIds: ['c.one', 'c.two'],
    localDate: finishedAt.slice(0, 10),
  };
}

describe('pathExamResult', () => {
  it('says nothing has been sat when there are no attempts', () => {
    expect(pathExamResult(undefined)).toEqual({
      attempts: 0,
      best: undefined,
      passed: false,
      firstPass: undefined,
    });
  });

  it('keeps the best share and stays unpassed below 80%', () => {
    const result = pathExamResult([attempt(10, 28, 1), attempt(20, 28, 2), attempt(15, 28, 3)]);
    expect(result.attempts).toBe(3);
    expect(result.best).toMatchObject({ right: 20, total: 28 });
    expect(result.passed).toBe(false);
    expect(result.firstPass).toBeUndefined();
  });

  it('compares shares, not raw counts, across exams of different length', () => {
    const result = pathExamResult([attempt(20, 28, 1), attempt(10, 11, 2)]);
    expect(result.best).toMatchObject({ right: 10, total: 11 });
  });

  it('passes from the first attempt at 80% or more, and keeps that date', () => {
    const result = pathExamResult([attempt(12, 28, 1), attempt(23, 28, 4), attempt(27, 28, 9)]);
    expect(result.passed).toBe(true);
    expect(result.firstPass).toMatchObject({ right: 23, total: 28, localDate: '2026-09-04' });
    expect(result.best).toMatchObject({ right: 27 });
  });

  it('stays passed after a later, lower attempt', () => {
    const result = pathExamResult([attempt(25, 28, 1), attempt(3, 28, 2)]);
    expect(result.passed).toBe(true);
    expect(result.firstPass?.localDate).toBe('2026-09-01');
  });

  it('ignores an empty attempt when choosing the best', () => {
    const result = pathExamResult([attempt(0, 0, 1)]);
    expect(result.attempts).toBe(1);
    expect(result.best).toBeUndefined();
  });
});
