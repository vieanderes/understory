import { describe, expect, it } from 'vitest';
import {
  applyWeeks,
  BASE_XP,
  calibrationGap,
  calibrationGapByModule,
  DEFAULT_RANK_THRESHOLDS,
  isHypercorrectionCandidate,
  MIN_CALIBRATION_SAMPLE,
  rankFor,
  selfGradesRunHigh,
  weekKey,
  xpFor,
  xpKindForStepType,
  type CalibrationAnswer,
  type RankInput,
  type WeekRecord,
} from '@/core/gamification';

describe('xpFor', () => {
  it('is round(base * s * spacingBonus) in the plain case', () => {
    const xp = xpFor({
      kind: 'code-challenge',
      score: 1,
      wasScheduled: true,
      challengeFirstWrongAttempt: false,
      withinCooldown: false,
    });
    expect(xp).toBe(BASE_XP['code-challenge']);
  });

  it('applies the spacing bonus from R at the moment of review', () => {
    const xp = xpFor({
      kind: 'recall',
      score: 1,
      retrievabilityBefore: 0.5,
      wasScheduled: true,
      challengeFirstWrongAttempt: false,
      withinCooldown: false,
    });
    expect(xp).toBe(Math.round(BASE_XP.recall * 1 * 1.5));
  });

  it('caps the spacing bonus at 1.5', () => {
    const xp = xpFor({
      kind: 'recall',
      score: 1,
      retrievabilityBefore: 0,
      wasScheduled: true,
      challengeFirstWrongAttempt: false,
      withinCooldown: false,
    });
    expect(xp).toBe(Math.round(BASE_XP.recall * 1 * 1.5));
  });

  it('earns 0 for an unscheduled item with R above 0.95', () => {
    const xp = xpFor({
      kind: 'recall',
      score: 1,
      retrievabilityBefore: 0.97,
      wasScheduled: false,
      challengeFirstWrongAttempt: false,
      withinCooldown: false,
    });
    expect(xp).toBe(0);
  });

  it('does not apply the no-cramming rule when R is not given (defaults to 0, never above the threshold)', () => {
    const xp = xpFor({
      kind: 'recall',
      score: 1,
      wasScheduled: false,
      challengeFirstWrongAttempt: false,
      withinCooldown: false,
    });
    expect(xp).toBeGreaterThan(0);
  });

  it('does not apply the no-cramming rule to a scheduled review', () => {
    const xp = xpFor({
      kind: 'recall',
      score: 1,
      retrievabilityBefore: 0.97,
      wasScheduled: true,
      challengeFirstWrongAttempt: false,
      withinCooldown: false,
    });
    expect(xp).toBeGreaterThan(0);
  });

  it('earns 0 for the same item within 24 hours', () => {
    const xp = xpFor({
      kind: 'recall',
      score: 1,
      wasScheduled: true,
      challengeFirstWrongAttempt: false,
      withinCooldown: true,
    });
    expect(xp).toBe(0);
  });

  it('earns half base for a genuine challenge-first attempt that was wrong', () => {
    const xp = xpFor({
      kind: 'code-challenge',
      score: 0,
      wasScheduled: true,
      challengeFirstWrongAttempt: true,
      withinCooldown: false,
    });
    expect(xp).toBe(Math.round(0.5 * BASE_XP['code-challenge']));
  });

  it('earns 0 for prose and other non-scored kinds', () => {
    const xp = xpFor({
      kind: 'none',
      score: 1,
      wasScheduled: true,
      challengeFirstWrongAttempt: false,
      withinCooldown: false,
    });
    expect(xp).toBe(0);
  });
});

describe('xpKindForStepType', () => {
  it('maps recognise-family steps to predict-mc-fill', () => {
    expect(xpKindForStepType('predict-output')).toBe('predict-mc-fill');
    expect(xpKindForStepType('multiple-choice')).toBe('predict-mc-fill');
    expect(xpKindForStepType('fill-blank')).toBe('predict-mc-fill');
  });

  it('maps arrange-family steps to parsons-trace', () => {
    expect(xpKindForStepType('parsons')).toBe('parsons-trace');
    expect(xpKindForStepType('trace-table')).toBe('parsons-trace');
  });

  it('maps a checked playground to the code-challenge bucket', () => {
    expect(xpKindForStepType('playground')).toBe('code-challenge');
  });

  it('maps a checked sql step to the code-challenge bucket', () => {
    expect(xpKindForStepType('sql')).toBe('code-challenge');
  });

  it('maps lab checkpoints on their own', () => {
    expect(xpKindForStepType('lab')).toBe('lab-checkpoint');
  });

  it('maps bug-hunt, ai-review and explain-back together', () => {
    expect(xpKindForStepType('bug-hunt')).toBe('bug-hunt-ai-review-explain');
    expect(xpKindForStepType('ai-review')).toBe('bug-hunt-ai-review-explain');
    expect(xpKindForStepType('explain-back')).toBe('bug-hunt-ai-review-explain');
  });

  it('maps code-challenge and incident on their own', () => {
    expect(xpKindForStepType('code-challenge')).toBe('code-challenge');
    expect(xpKindForStepType('incident')).toBe('incident');
  });
});

describe('weekKey', () => {
  it('gives the ISO week for a Monday', () => {
    expect(weekKey('2026-09-14')).toBe('2026-W38');
  });

  it('gives the same key for every day in that week', () => {
    expect(weekKey('2026-09-17')).toBe('2026-W38');
    expect(weekKey('2026-09-20')).toBe('2026-W38');
  });

  it("assigns the ISO year by the week's Thursday, not the given day", () => {
    // 2026-12-28 is a Monday; that week's Thursday (2026-12-31) is still in 2026,
    // so this is the year's last week, not week 1 of 2027.
    expect(weekKey('2026-12-28')).toBe('2026-W53');
  });
});

describe('applyWeeks', () => {
  const tier = 'light' as const;
  const met: (weekKeySuffix: string) => WeekRecord = (weekKeySuffix) => ({
    weekKey: `2026-W${weekKeySuffix}`,
    xp: 200,
    tier,
  });
  const missed: (weekKeySuffix: string) => WeekRecord = (weekKeySuffix) => ({
    weekKey: `2026-W${weekKeySuffix}`,
    xp: 0,
    tier,
  });

  it('counts consecutive met weeks as the run', () => {
    const summary = applyWeeks([met('01'), met('02'), met('03')]);
    expect(summary.run).toBe(3);
    expect(summary.bestRun).toBe(3);
  });

  it('spends a reserve automatically on a missed week, keeping the run alive', () => {
    const summary = applyWeeks([met('01'), missed('02')]);
    expect(summary.run).toBe(2);
    expect(summary.reserve).toBe(0); // started with 1, spent it
  });

  it('ends the run when a week is missed with no reserve left', () => {
    const summary = applyWeeks([missed('01'), missed('02')]);
    expect(summary.run).toBe(0);
    expect(summary.lastWeekMissedWithNoReserve).toBe(true);
  });

  it('earns 1 reserve for every 4 met weeks, capped at 2', () => {
    const weeks = ['01', '02', '03', '04', '05', '06', '07', '08'].map(met);
    const summary = applyWeeks(weeks);
    // starts at 1, earns +1 at week 4 (spent none), earns +1 at week 8 -> capped at 2
    expect(summary.reserve).toBe(2);
  });

  it('remembers the best run even after it ends', () => {
    // met, met, missed (reserve spent, run continues to 3), missed (no reserve left, run ends)
    const summary = applyWeeks([met('01'), met('02'), missed('03'), missed('04')]);
    expect(summary.bestRun).toBe(3);
    expect(summary.run).toBe(0);
  });
});

describe('rankFor', () => {
  const baseInput: RankInput = {
    placementDone: true,
    solidCount: 0,
    capstonesCompleted: 0,
    totalCapstones: 20,
    aiReviewsPassed: 0,
    calibrationGapPoints: 0,
    incidentsResolved: 0,
    fluentCountByKeyModule: [0, 0, 0, 0],
    totalConcepts: 1000,
  };

  it('is reader once placement is done, with no other evidence', () => {
    expect(rankFor(baseInput)).toBe('reader');
  });

  it('is tracer at 25 solid concepts', () => {
    expect(rankFor({ ...baseInput, solidCount: 25 })).toBe('tracer');
  });

  it('is builder at 60 solid and 3 capstones', () => {
    expect(rankFor({ ...baseInput, solidCount: 60, capstonesCompleted: 3 })).toBe('builder');
  });

  it('does not reach builder with enough solid but too few capstones', () => {
    expect(rankFor({ ...baseInput, solidCount: 60, capstonesCompleted: 2 })).toBe('tracer');
  });

  it('is reviewer at 100 solid, 15 ai-reviews and calibration within 15 points', () => {
    const input = {
      ...baseInput,
      solidCount: 100,
      capstonesCompleted: 3,
      aiReviewsPassed: 15,
      calibrationGapPoints: 15,
    };
    expect(rankFor(input)).toBe('reviewer');
  });

  it('does not reach reviewer if the calibration gap is too wide', () => {
    const input = {
      ...baseInput,
      solidCount: 100,
      capstonesCompleted: 3,
      aiReviewsPassed: 15,
      calibrationGapPoints: 16,
    };
    expect(rankFor(input)).toBe('builder');
  });

  it('is engineer at 160 solid and 5 capstones, one per part up to Production', () => {
    expect(rankFor({ ...baseInput, solidCount: 160, capstonesCompleted: 5 })).toBe('engineer');
    expect(rankFor({ ...baseInput, solidCount: 160, capstonesCompleted: 4 })).toBe('builder');
  });

  it('asks Architect for every capstone the course has, seven with seven parts', () => {
    const input: RankInput = {
      ...baseInput,
      solidCount: 220,
      totalCapstones: 7,
      aiReviewsPassed: 15,
      incidentsResolved: 8,
      fluentCountByKeyModule: [10, 10, 10, 10],
    };
    expect(rankFor({ ...input, capstonesCompleted: 7 })).toBe('architect');
    expect(rankFor({ ...input, capstonesCompleted: 6 })).toBe('engineer');
  });

  it('is architect once every requirement, including all key modules fluent, is met', () => {
    const input: RankInput = {
      ...baseInput,
      solidCount: 220,
      capstonesCompleted: 20,
      aiReviewsPassed: 15,
      calibrationGapPoints: 0,
      incidentsResolved: 8,
      fluentCountByKeyModule: [10, 10, 10, 10],
    };
    expect(rankFor(input)).toBe('architect');
  });

  it("caps a rank's solid requirement at the number of concepts that exist", () => {
    const input = { ...baseInput, solidCount: 5, totalConcepts: 5 };
    expect(rankFor(input)).toBe('tracer');
  });

  it('never demotes: the caller is expected to pass a high-water mark', () => {
    // rankFor is pure and stateless; this documents that it always reflects the
    // input given, so "never demote" is the caller's responsibility to track.
    const early = rankFor({ ...baseInput, solidCount: 60, capstonesCompleted: 3 });
    const later = rankFor({ ...baseInput, solidCount: 10 });
    expect(early).toBe('builder');
    expect(later).toBe('reader');
  });

  it('uses DEFAULT_RANK_THRESHOLDS when none is given', () => {
    expect(rankFor({ ...baseInput, solidCount: DEFAULT_RANK_THRESHOLDS.tracerSolid })).toBe(
      'tracer',
    );
  });

  it('treats a missing calibration gap as 0 points for the reviewer requirement', () => {
    const input = {
      ...baseInput,
      solidCount: 100,
      capstonesCompleted: 3,
      aiReviewsPassed: 15,
      calibrationGapPoints: undefined,
    };
    expect(rankFor(input)).toBe('reviewer');
  });
});

describe('calibrationGap', () => {
  function answers(
    n: number,
    correctCount: number,
    confidence: CalibrationAnswer['confidence'],
  ): CalibrationAnswer[] {
    return Array.from({ length: n }, (_, i) => ({ confidence, correct: i < correctCount }));
  }

  it('is undefined below the minimum sample size', () => {
    const result = calibrationGap(answers(MIN_CALIBRATION_SAMPLE - 1, 1, 'certain'));
    expect(result.gapPoints).toBeUndefined();
  });

  it('is mean confidence minus accuracy, in percentage points', () => {
    // 5 "certain" (0.95) answers, 3 correct: accuracy 0.6, gap = (0.95 - 0.6) * 100 = 35
    const result = calibrationGap(answers(5, 3, 'certain'));
    expect(result.gapPoints).toBe(35);
  });

  it('is 0 for a perfectly calibrated "fairly" run', () => {
    // 0.75 confidence, 75% accuracy over 8 answers -> 6 correct
    const result = calibrationGap(answers(8, 6, 'fairly'));
    expect(result.gapPoints).toBe(0);
  });
});

describe('calibrationGapByModule', () => {
  it('groups by module and drops modules under the minimum sample', () => {
    const big = Array.from({ length: MIN_CALIBRATION_SAMPLE }, () => ({
      confidence: 'certain' as const,
      correct: false,
      moduleId: 'js',
    }));
    const small: CalibrationAnswer[] = [{ confidence: 'certain', correct: false, moduleId: 'css' }];
    const result = calibrationGapByModule([...big, ...small]);
    expect(Object.keys(result)).toEqual(['js']);
    expect(result.js?.gapPoints).toBe(95);
  });

  it('ignores answers with no module (for example, lesson-context step answers)', () => {
    const withoutModule: CalibrationAnswer = { confidence: 'guess', correct: true };
    const result = calibrationGapByModule([withoutModule]);
    expect(result).toEqual({});
  });
});

describe('isHypercorrectionCandidate', () => {
  it('flags a certain-and-wrong answer', () => {
    expect(isHypercorrectionCandidate({ confidence: 'certain', correct: false })).toBe(true);
  });

  it('does not flag a certain-and-right answer', () => {
    expect(isHypercorrectionCandidate({ confidence: 'certain', correct: true })).toBe(false);
  });

  it('does not flag a guess-and-wrong answer', () => {
    expect(isHypercorrectionCandidate({ confidence: 'guess', correct: false })).toBe(false);
  });
});

describe('selfGradesRunHigh', () => {
  it('is true after three disagreements running', () => {
    const checks = [
      { selfGradeScore: 1, transferCorrect: false },
      { selfGradeScore: 0.7, transferCorrect: false },
      { selfGradeScore: 1, transferCorrect: false },
    ];
    expect(selfGradesRunHigh(checks)).toBe(true);
  });

  it('resets when the most recent check agrees', () => {
    const checks = [
      { selfGradeScore: 1, transferCorrect: false },
      { selfGradeScore: 1, transferCorrect: false },
      { selfGradeScore: 1, transferCorrect: true },
    ];
    expect(selfGradesRunHigh(checks)).toBe(false);
  });

  it('is false with fewer than three checks', () => {
    expect(selfGradesRunHigh([{ selfGradeScore: 1, transferCorrect: false }])).toBe(false);
  });

  it('is false for a low self-grade, since that is not "running high"', () => {
    const checks = [
      { selfGradeScore: 0, transferCorrect: false },
      { selfGradeScore: 0, transferCorrect: false },
      { selfGradeScore: 0, transferCorrect: false },
    ];
    expect(selfGradesRunHigh(checks)).toBe(false);
  });
});
