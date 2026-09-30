import { describe, expect, it } from 'vitest';
import {
  dueCards,
  ratingFromScore,
  retrievability,
  schedule,
  seedCard,
} from '@/core/scheduling/fsrs';
import type { CardState } from '@/core/scheduling/card-state';

describe('retrievability', () => {
  it('is 0.9 at t = S, the FSRS-4.5 definition (LEARNING-SCIENCE.md B4)', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 4);
    expect(retrievability(30, 30)).toBeCloseTo(0.9, 4);
  });

  it('is 1 with no elapsed time', () => {
    expect(retrievability(10, 0)).toBeCloseTo(1, 6);
  });

  it('decreases as elapsed time grows', () => {
    const soon = retrievability(10, 2);
    const later = retrievability(10, 20);
    expect(later).toBeLessThan(soon);
  });

  it('is 0 for a non-positive stability (guards against divide by zero)', () => {
    expect(retrievability(0, 5)).toBe(0);
  });

  it('treats negative elapsed time as zero elapsed time', () => {
    expect(retrievability(10, -5)).toBeCloseTo(retrievability(10, 0), 6);
  });
});

describe('schedule', () => {
  const now = new Date('2026-09-17T10:00:00Z');

  it('accepts a hand-built card with no learningSteps or lastReview (both optional)', () => {
    const minimal: CardState = {
      due: '2026-09-16T10:00:00.000Z',
      stability: 5,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      state: 'review',
      scheduledDays: 5,
      elapsedDays: 5,
    };
    const next = schedule(minimal, 3, now);
    expect(next.reps).toBe(2);
  });

  it('creates a fresh card on the first review', () => {
    const card = schedule(null, 3, now);
    expect(card.reps).toBe(1);
    expect(card.state).not.toBe('new');
    expect(new Date(card.due).getTime()).toBeGreaterThan(now.getTime());
  });

  it('is deterministic for a fixed clock and rating (fuzz is off)', () => {
    const a = schedule(null, 3, now);
    const b = schedule(null, 3, now);
    expect(a).toEqual(b);
  });

  it('grows stability further on a second "Good" review than a single review gives', () => {
    const first = schedule(null, 3, now);
    const second = schedule(first, 3, new Date(first.due));
    expect(second.stability).toBeGreaterThan(first.stability);
    expect(second.reps).toBe(2);
  });

  it('produces plain JSON: ISO strings, not Date objects', () => {
    const card = schedule(null, 3, now);
    expect(typeof card.due).toBe('string');
    expect(typeof card.lastReview).toBe('string');
    expect(() => JSON.stringify(card)).not.toThrow();
  });

  it('records a lapse on "Again" after a successful review', () => {
    const first = schedule(null, 3, now);
    const lapsed = schedule(first, 1, new Date(first.due));
    expect(lapsed.lapses).toBeGreaterThanOrEqual(1);
  });
});

describe('seedCard', () => {
  it('enters a test-out pass at S = 7 days (LEARNING-SCIENCE.md B5)', () => {
    const now = new Date('2026-09-17T10:00:00Z');
    const card = seedCard(now, 7, 5);
    expect(card.stability).toBe(7);
    expect(card.state).toBe('review');
  });
});

describe('dueCards', () => {
  const now = new Date('2026-09-17T10:00:00Z');
  const dueCard: CardState = {
    due: '2026-09-16T10:00:00.000Z',
    stability: 5,
    difficulty: 5,
    reps: 1,
    lapses: 0,
    state: 'review',
    scheduledDays: 5,
    elapsedDays: 5,
  };
  const notYetDue: CardState = { ...dueCard, due: '2026-09-20T10:00:00.000Z' };
  const dueEarlier: CardState = { ...dueCard, due: '2026-09-10T10:00:00.000Z' };

  it('returns only cards whose due date has passed, earliest first', () => {
    const cards = new Map([
      ['skill:a#1', dueCard],
      ['skill:b#1', notYetDue],
      ['skill:c#1', dueEarlier],
    ]);
    expect(dueCards(cards, now)).toEqual(['skill:c#1', 'skill:a#1']);
  });

  it('returns an empty list when nothing is due', () => {
    const cards = new Map([['skill:b#1', notYetDue]]);
    expect(dueCards(cards, now)).toEqual([]);
  });
});

describe('ratingFromScore', () => {
  it('maps a zero score to Again', () => {
    expect(ratingFromScore(0)).toBe(1);
  });

  it('maps a struggling score to Hard', () => {
    expect(ratingFromScore(0.2)).toBe(2);
  });

  it('maps a solid second-try score to Good', () => {
    expect(ratingFromScore(0.6)).toBe(3);
  });

  it('maps a perfect confident first try to Easy', () => {
    expect(ratingFromScore(1, 'certain')).toBe(4);
  });

  it('maps a perfect but guessed first try to Good, not Easy', () => {
    expect(ratingFromScore(1, 'guess')).toBe(3);
  });

  it('defaults a perfect score with no stated confidence to Easy', () => {
    expect(ratingFromScore(1)).toBe(4);
  });
});
