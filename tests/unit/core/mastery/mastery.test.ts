import { describe, expect, it } from 'vitest';
import {
  ALPHA_BY_FAMILY,
  attemptScore,
  FLUENT_MIN_DAYS_APART,
  hasFluentSpacing,
  masteryOf,
  masteryState,
  memoryOf,
  updateSkill,
  type ConceptEvidence,
} from '@/core/mastery';
import type { CardState } from '@/core/scheduling/card-state';

describe('attemptScore', () => {
  it('scores 1.0 for a correct first try with no hint', () => {
    expect(attemptScore({ tryNumber: 1, hintsUsed: 0, revealed: false, correct: true })).toBe(1);
  });

  it('scores 0.6 for a correct second try', () => {
    expect(attemptScore({ tryNumber: 2, hintsUsed: 0, revealed: false, correct: true })).toBe(0.6);
  });

  it('scores 0.6 for a correct later try (no hints, not revealed)', () => {
    expect(attemptScore({ tryNumber: 4, hintsUsed: 0, revealed: false, correct: true })).toBe(0.6);
  });

  it('scores max(0.2, 1 - 0.2 * hints) when hints were used', () => {
    expect(
      attemptScore({ tryNumber: 1, hintsUsed: 1, revealed: false, correct: true }),
    ).toBeCloseTo(0.8);
    expect(
      attemptScore({ tryNumber: 1, hintsUsed: 3, revealed: false, correct: true }),
    ).toBeCloseTo(0.4);
    expect(attemptScore({ tryNumber: 1, hintsUsed: 10, revealed: false, correct: true })).toBe(0.2);
  });

  it('scores 0 when the solution was revealed, regardless of anything else', () => {
    expect(attemptScore({ tryNumber: 1, hintsUsed: 0, revealed: true, correct: true })).toBe(0);
  });

  it('scores 0 for a final wrong answer', () => {
    expect(attemptScore({ tryNumber: 3, hintsUsed: 0, revealed: false, correct: false })).toBe(0);
  });
});

describe('updateSkill', () => {
  it('uses alpha 0.15 for recognise formats', () => {
    expect(updateSkill(0.5, 1, 'recognise')).toBeCloseTo(0.5 * 0.85 + 1 * 0.15);
    expect(ALPHA_BY_FAMILY.recognise).toBe(0.15);
  });

  it('uses alpha 0.25 for arrange formats', () => {
    expect(updateSkill(0.5, 1, 'arrange')).toBeCloseTo(0.5 * 0.75 + 1 * 0.25);
  });

  it('uses alpha 0.35 for produce formats', () => {
    expect(updateSkill(0.5, 1, 'produce')).toBeCloseTo(0.5 * 0.65 + 1 * 0.35);
  });

  it('moves P towards 0 on a failed attempt', () => {
    expect(updateSkill(0.8, 0, 'produce')).toBeCloseTo(0.8 * 0.65);
  });
});

describe('memoryOf', () => {
  const now = new Date('2026-09-17T00:00:00Z');

  it('is 0 for a concept with no cards', () => {
    expect(memoryOf([], now)).toBe(0);
  });

  it('ignores cards that have never been reviewed', () => {
    const neverReviewed: CardState = {
      due: '2026-09-18T00:00:00.000Z',
      stability: 5,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      state: 'new',
      scheduledDays: 0,
      elapsedDays: 0,
    };
    expect(memoryOf([neverReviewed], now)).toBe(0);
  });

  it('is the mean R(now) across reviewed cards', () => {
    const cardA: CardState = {
      due: '2026-09-24T00:00:00.000Z',
      stability: 10,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      state: 'review',
      scheduledDays: 10,
      elapsedDays: 0,
      lastReview: '2026-09-17T00:00:00.000Z', // reviewed just now: R = 1
    };
    const cardB: CardState = {
      ...cardA,
      stability: 7,
      lastReview: '2026-09-10T00:00:00.000Z', // reviewed 7 days ago: R = 0.9 at t = S
    };
    const mean = memoryOf([cardA, cardB], now);
    expect(mean).toBeGreaterThan(0.9);
    expect(mean).toBeLessThan(1);
  });
});

describe('masteryOf', () => {
  const now = new Date('2026-09-17T00:00:00Z');

  function evidence(overrides: Partial<ConceptEvidence> = {}): ConceptEvidence {
    return {
      p: 0.9,
      familiesPassed: new Set(['recognise', 'arrange']),
      produceOrExplainPassed: true,
      ...overrides,
    };
  }

  it('is 0.4 * M + 0.6 * P when no cap applies', () => {
    const value = masteryOf(evidence({ p: 0.5 }), [], now);
    expect(value).toBeCloseTo(0.4 * 0 + 0.6 * 0.5);
  });

  it('caps at 0.6 until two format families have passed', () => {
    const value = masteryOf(evidence({ p: 1, familiesPassed: new Set(['recognise']) }), [], now);
    expect(value).toBe(0.6);
  });

  it('caps at 0.8 until a produce or explain item has passed', () => {
    const freshCard: CardState = {
      due: '2026-09-24T00:00:00.000Z',
      stability: 10,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      state: 'review',
      scheduledDays: 10,
      elapsedDays: 0,
      lastReview: '2026-09-17T00:00:00.000Z', // R = 1 right now
    };
    const value = masteryOf(evidence({ p: 1, produceOrExplainPassed: false }), [freshCard], now);
    expect(value).toBe(0.8);
  });

  it('is uncapped once two families and a produce/explain pass are both true', () => {
    const freshCard: CardState = {
      due: '2026-09-24T00:00:00.000Z',
      stability: 10,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      state: 'review',
      scheduledDays: 10,
      elapsedDays: 0,
      lastReview: '2026-09-17T00:00:00.000Z',
    };
    const value = masteryOf(evidence({ p: 1 }), [freshCard], now);
    expect(value).toBeCloseTo(1);
  });
});

describe('masteryState', () => {
  const base = {
    assumed: false,
    hasEvidence: true,
    wasEverSolidOrFluent: false,
    mastery: 0,
    meanStabilityDays: 0,
    fluentSpacingMet: false,
  };

  it('is unseen with no evidence and no placement assumption', () => {
    expect(masteryState({ ...base, hasEvidence: false })).toBe('unseen');
  });

  it('is assumed with no evidence but a placement assumption', () => {
    expect(masteryState({ ...base, hasEvidence: false, assumed: true })).toBe('assumed');
  });

  it('is introduced below 0.4', () => {
    expect(masteryState({ ...base, mastery: 0.1 })).toBe('introduced');
  });

  it('is practised from 0.4 to under 0.7', () => {
    expect(masteryState({ ...base, mastery: 0.4 })).toBe('practised');
    expect(masteryState({ ...base, mastery: 0.69 })).toBe('practised');
  });

  it("is solid from 0.7 to under fluent's other conditions", () => {
    expect(masteryState({ ...base, mastery: 0.7 })).toBe('solid');
    expect(masteryState({ ...base, mastery: 0.9 })).toBe('solid'); // fails stability/spacing
  });

  it('is fluent only once mastery, stability and spacing all clear their bars', () => {
    expect(
      masteryState({ ...base, mastery: 0.85, meanStabilityDays: 21, fluentSpacingMet: true }),
    ).toBe('fluent');
    expect(
      masteryState({ ...base, mastery: 0.85, meanStabilityDays: 20, fluentSpacingMet: true }),
    ).toBe('solid');
  });

  it('is gap once mastery falls below 0.6 after being solid or fluent', () => {
    expect(masteryState({ ...base, wasEverSolidOrFluent: true, mastery: 0.5 })).toBe('gap');
  });

  it('is not gap when mastery has only dropped to 0.6 or above', () => {
    expect(masteryState({ ...base, wasEverSolidOrFluent: true, mastery: 0.65 })).toBe('practised');
  });
});

describe('hasFluentSpacing', () => {
  it('is false with fewer than two distinct success days', () => {
    expect(hasFluentSpacing([])).toBe(false);
    expect(hasFluentSpacing(['2026-09-01', '2026-09-01'])).toBe(false);
  });

  it(`is false when the two furthest days are under ${FLUENT_MIN_DAYS_APART} days apart`, () => {
    expect(hasFluentSpacing(['2026-09-01', '2026-09-05'])).toBe(false);
  });

  it('is true once two distinct days are at least 7 days apart', () => {
    expect(hasFluentSpacing(['2026-09-01', '2026-09-08'])).toBe(true);
  });
});
