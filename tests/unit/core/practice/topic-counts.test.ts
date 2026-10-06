import { describe, expect, it } from 'vitest';
import { topicCounts } from '@/core/practice/topic-counts';
import type { Catalog } from '@/core/practice/catalog';
import { initialProgressState } from '@/core/progress/reducer';
import type { CardState } from '@/core/scheduling/card-state';

const card = (due: string): CardState => ({
  due,
  stability: 5,
  difficulty: 5,
  reps: 1,
  lapses: 0,
  state: 'review',
  scheduledDays: 5,
  elapsedDays: 5,
  lastReview: '2026-09-11T10:00:00.000Z',
});

const catalog: Catalog = {
  concepts: [],
  skillItems: ['python.a', 'python.b', 'algo.a'].map((lessonId) => ({
    lessonId,
    stepId: 's',
    type: 'multiple-choice',
    concept: lessonId,
    difficulty: 1,
  })),
  recallCards: [{ lessonId: 'python.c', cardId: 'c', concept: 'python.c' }],
};

describe('topic counts', () => {
  it('counts what is due and the lessons not taken yet, per topic', () => {
    const counts = topicCounts(
      {
        ...initialProgressState(),
        completedLessons: new Set(['python.a']),
        cards: {
          'skill:python.a#s': card('2026-09-16T10:00:00.000Z'),
          'skill:algo.a#s': card('2026-12-01T10:00:00.000Z'),
        },
      },
      catalog,
      new Date('2026-09-17T10:00:00Z'),
    );
    expect(counts.python).toEqual({ due: 1, fresh: 2 });
    expect(counts.algorithms).toEqual({ due: 0, fresh: 1 });
    expect(counts.web).toEqual({ due: 0, fresh: 0 });
  });
});
