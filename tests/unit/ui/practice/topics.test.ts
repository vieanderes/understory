import { describe, expect, it } from 'vitest';
import { initialProgressState } from '@/core/progress/reducer';
import type { CardState } from '@/core/scheduling/card-state';
import { defaultTopics, parseTopics, sessionHref } from '@/features/practice/topics';

describe('practice topics in the session URL', () => {
  it('keeps known topics in the canonical order and drops the rest', () => {
    expect(parseTopics('algorithms,python,nope')).toEqual(['python', 'algorithms']);
    expect(parseTopics(null)).toEqual([]);
    expect(parseTopics('')).toEqual([]);
  });

  it('adds the query only when topics are chosen', () => {
    expect(sessionHref(10, [])).toBe('/practise/session/10');
    expect(sessionHref(5, ['python', 'ai'])).toBe('/practise/session/5?topics=python,ai');
  });
});

describe('the topics chosen by default', () => {
  const base = initialProgressState();
  const started = {
    ...base,
    completedLessons: new Set(['python.functions']),
    cards: { 'lesson:algo.sort#card-1': {} as CardState },
  };

  it('is everything for a new learner', () => {
    expect(defaultTopics(base)).toEqual([]);
  });

  it('follows what the learner has started', () => {
    expect(defaultTopics(started)).toEqual(['python', 'algorithms']);
  });

  it('prefers what the learner said they care about', () => {
    expect(
      defaultTopics({ ...started, profile: { interests: ['ai', 'web'], news: true } }),
    ).toEqual(['web', 'ai']);
  });
});
