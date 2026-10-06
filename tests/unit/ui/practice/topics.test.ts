import { describe, expect, it } from 'vitest';
import { parseTopics, sessionHref } from '@/features/practice/topics';

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
