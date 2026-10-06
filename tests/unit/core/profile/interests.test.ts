import { describe, expect, it } from 'vitest';
import {
  INTERESTS,
  INTEREST_COPY,
  interestsForGoal,
  matchesInterests,
  newsTopicRank,
} from '@/core/profile';

describe('interests', () => {
  it('names every interest, with a label and at least one module', () => {
    for (const id of INTERESTS) {
      expect(INTEREST_COPY[id].label.length).toBeGreaterThan(0);
      expect(INTEREST_COPY[id].modules.length).toBeGreaterThan(0);
    }
  });

  it('matches a lesson id by its module prefix', () => {
    expect(matchesInterests('python.functions', ['python'])).toBe(true);
    expect(matchesInterests('pyai.pytest', ['python'])).toBe(true);
    expect(matchesInterests('react.state', ['python'])).toBe(false);
    expect(matchesInterests('aisys.guardrails', ['python', 'ai'])).toBe(true);
  });

  it('matches everything when nothing is picked', () => {
    expect(matchesInterests('react.state', [])).toBe(true);
  });

  it('puts the news topics a learner follows first, keeping the rest in order', () => {
    const topics = ['security', 'web-platform', 'ai-agents', 'swift-ios'];
    const ranked = [...topics].sort((a, b) => newsTopicRank(a, ['ai']) - newsTopicRank(b, ['ai']));
    expect(ranked[0]).toBe('ai-agents');
    expect(newsTopicRank('security', [])).toBe(newsTopicRank('swift-ios', []));
  });

  it('suggests interests from a plan goal', () => {
    expect(interestsForGoal('ai-engineer')).toContain('ai');
    expect(interestsForGoal('interviews')).toContain('algorithms');
    expect(interestsForGoal('from-zero')).toContain('basics');
    for (const id of interestsForGoal('senior')) expect(INTERESTS).toContain(id);
  });
});
