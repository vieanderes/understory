import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TARGET_BAND,
  bandFit,
  demotionOffered,
  expectedSuccess,
  itemRating,
  modeFor,
  promotionOffered,
  shiftTargetBand,
  updateTheta,
} from '@/core/mastery/difficulty';

describe('itemRating', () => {
  it('is 800 + 200 * d', () => {
    expect(itemRating(1)).toBe(1000);
    expect(itemRating(5)).toBe(1800);
  });
});

describe('expectedSuccess', () => {
  it('is 0.5 when theta equals the item rating', () => {
    expect(expectedSuccess(itemRating(3), 3)).toBeCloseTo(0.5);
  });

  it('rises as theta rises above the item rating', () => {
    const low = expectedSuccess(itemRating(3) - 400, 3);
    const high = expectedSuccess(itemRating(3) + 400, 3);
    expect(high).toBeGreaterThan(low);
  });

  it('stays within (0, 1)', () => {
    expect(expectedSuccess(0, 5)).toBeGreaterThan(0);
    expect(expectedSuccess(5000, 1)).toBeLessThan(1);
  });
});

describe('updateTheta', () => {
  it('rises after an unexpected success', () => {
    expect(updateTheta(1000, 1, 0.5)).toBe(1000 + 24 * 0.5);
  });

  it('falls after an unexpected failure', () => {
    expect(updateTheta(1000, 0, 0.5)).toBe(1000 - 24 * 0.5);
  });

  it('does not move when the outcome matches the prediction', () => {
    expect(updateTheta(1000, 0.5, 0.5)).toBe(1000);
  });
});

describe('shiftTargetBand', () => {
  it('leaves the band alone inside the healthy 0.65-0.90 zone', () => {
    expect(shiftTargetBand(DEFAULT_TARGET_BAND, 0.8)).toEqual(DEFAULT_TARGET_BAND);
  });

  it('raises the band when the running rate is above 0.9', () => {
    const shifted = shiftTargetBand(DEFAULT_TARGET_BAND, 0.95);
    expect(shifted.low).toBeGreaterThan(DEFAULT_TARGET_BAND.low);
    expect(shifted.high).toBeGreaterThan(DEFAULT_TARGET_BAND.high);
  });

  it('lowers the band when the running rate is below 0.65', () => {
    const shifted = shiftTargetBand(DEFAULT_TARGET_BAND, 0.5);
    expect(shifted.low).toBeLessThan(DEFAULT_TARGET_BAND.low);
    expect(shifted.high).toBeLessThan(DEFAULT_TARGET_BAND.high);
  });

  it('never leaves [0, 1]', () => {
    const shifted = shiftTargetBand({ low: 0.95, high: 0.98 }, 0.95);
    expect(shifted.high).toBeLessThanOrEqual(1);
  });
});

describe('bandFit', () => {
  it('is 0 inside the band', () => {
    expect(bandFit(0.8, DEFAULT_TARGET_BAND)).toBe(0);
  });

  it('is the distance below the band when p is too low', () => {
    expect(bandFit(0.5, DEFAULT_TARGET_BAND)).toBeCloseTo(0.2);
  });

  it('is the distance above the band when p is too high', () => {
    expect(bandFit(0.95, DEFAULT_TARGET_BAND)).toBeCloseTo(0.05);
  });
});

describe('modeFor', () => {
  it('is challenge-first when prerequisite mastery is at least 0.7', () => {
    expect(modeFor({ prerequisiteMasteryMean: 0.7, openingProblemP: 0 })).toBe('challenge-first');
  });

  it('is challenge-first when the opening problem p is at least 0.5', () => {
    expect(modeFor({ prerequisiteMasteryMean: 0, openingProblemP: 0.5 })).toBe('challenge-first');
  });

  it('is guided when neither threshold is met (ties go to Guided)', () => {
    expect(modeFor({ prerequisiteMasteryMean: 0.69, openingProblemP: 0.49 })).toBe('guided');
  });

  it('always honours a learner override', () => {
    expect(modeFor({ prerequisiteMasteryMean: 1, openingProblemP: 1, override: 'guided' })).toBe(
      'guided',
    );
  });
});

describe('promotionOffered', () => {
  it('is false with fewer than two lessons', () => {
    expect(promotionOffered([{ firstTryRate: 1, hintsUsed: 0 }])).toBe(false);
  });

  it('is true after two consecutive qualifying lessons', () => {
    const lessons = [
      { firstTryRate: 0.9, hintsUsed: 0 },
      { firstTryRate: 0.85, hintsUsed: 0 },
    ];
    expect(promotionOffered(lessons)).toBe(true);
  });

  it('is false if either of the last two lessons used a hint', () => {
    const lessons = [
      { firstTryRate: 1, hintsUsed: 1 },
      { firstTryRate: 1, hintsUsed: 0 },
    ];
    expect(promotionOffered(lessons)).toBe(false);
  });

  it('only looks at the most recent two lessons', () => {
    const lessons = [
      { firstTryRate: 0, hintsUsed: 5 },
      { firstTryRate: 0.9, hintsUsed: 0 },
      { firstTryRate: 0.9, hintsUsed: 0 },
    ];
    expect(promotionOffered(lessons)).toBe(true);
  });
});

describe('demotionOffered', () => {
  it('is true after two consolidation checks below 50%', () => {
    expect(demotionOffered([0.4, 0.3])).toBe(true);
  });

  it('is false if either of the last two checks reached 50%', () => {
    expect(demotionOffered([0.4, 0.5])).toBe(false);
  });

  it('is false with fewer than two checks', () => {
    expect(demotionOffered([0.1])).toBe(false);
  });
});
