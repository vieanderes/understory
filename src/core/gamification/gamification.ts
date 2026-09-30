/*
 * XP, ranks, the weekly goal and calibration (LEARNING-SCIENCE.md section C). There
 * are two ladders only: XP measures effort this week, rank measures proven
 * competence. Nothing here is stored; it is all derived from events.
 */

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

/** C: the XP base table. */
export type XpKind =
  | 'recall'
  | 'predict-mc-fill'
  | 'parsons-trace'
  | 'lab-checkpoint'
  | 'bug-hunt-ai-review-explain'
  | 'code-challenge'
  | 'incident'
  | 'test-out'
  | 'capstone'
  | 'none';

export const BASE_XP: Record<XpKind, number> = {
  recall: 2,
  'predict-mc-fill': 4,
  'parsons-trace': 6,
  'lab-checkpoint': 8,
  'bug-hunt-ai-review-explain': 10,
  'code-challenge': 15,
  incident: 25,
  'test-out': 60,
  capstone: 100,
  none: 0, // prose, opening the app, confidence taps
};

/** Maps a graded step's content type to its XP category. Explain-back is scored via
 * `explain_back_graded`, not `step_answered`, but shares the same base XP bucket as
 * bug-hunt and ai-review. */
export function xpKindForStepType(
  stepType:
    | 'predict-output'
    | 'multiple-choice'
    | 'trace-table'
    | 'fill-blank'
    | 'parsons'
    | 'bug-hunt'
    | 'ai-review'
    | 'code-challenge'
    | 'lab'
    | 'incident'
    | 'explain-back'
    | 'playground'
    | 'sql',
): XpKind {
  switch (stepType) {
    case 'predict-output':
    case 'multiple-choice':
    case 'fill-blank':
      return 'predict-mc-fill';
    case 'trace-table':
    case 'parsons':
      return 'parsons-trace';
    case 'lab':
      return 'lab-checkpoint';
    case 'bug-hunt':
    case 'ai-review':
    case 'explain-back':
      return 'bug-hunt-ai-review-explain';
    // A checked playground or sql step is written code judged by checks, like a challenge's tests.
    case 'code-challenge':
    case 'playground':
    case 'sql':
      return 'code-challenge';
    case 'incident':
      return 'incident';
  }
}

/** C: "an item with R above 0.95 that was not scheduled earns 0." */
const CRAM_RETRIEVABILITY_THRESHOLD = 0.95;
/** C: "spacingBonus = min(1.5, 1 + (1 - R))." */
const SPACING_BONUS_CAP = 1.5;
/** C: "an attempt with any submitted approach earns 0.5 * base even when wrong." */
const CHALLENGE_FIRST_WRONG_MULTIPLIER = 0.5;

export interface XpInput {
  readonly kind: XpKind;
  /** The attempt score `s`, 0..1 (mastery's `attemptScore`, or the self-grade mapping
   * below for explain-back, or 1/0 for a pass/fail event such as a test-out). */
  readonly score: number;
  /** R at the moment of review. Only meaningful for FSRS-scheduled reviews (recall
   * cards); omit it for lesson/practice steps that are not being spaced-repeated. */
  readonly retrievabilityBefore?: number;
  /** False only for an off-schedule recall review (reviewed before it was due). */
  readonly wasScheduled: boolean;
  /** True only for a genuine Challenge-first attempt that turned out wrong. */
  readonly challengeFirstWrongAttempt: boolean;
  /** True when the same item was already graded within the last 24 hours. */
  readonly withinCooldown: boolean;
}

/** `xp = round(base * s * spacingBonus)`, with the no-cramming, no-grinding and
 * challenge-first-effort exceptions (LEARNING-SCIENCE.md C). */
export function xpFor(input: XpInput): number {
  if (input.kind === 'none') return 0;
  const base = BASE_XP[input.kind];
  if (input.withinCooldown) return 0; // no grinding
  if (input.challengeFirstWrongAttempt) return Math.round(CHALLENGE_FIRST_WRONG_MULTIPLIER * base);
  if (!input.wasScheduled && (input.retrievabilityBefore ?? 0) > CRAM_RETRIEVABILITY_THRESHOLD)
    return 0; // no cramming
  const spacingBonus =
    input.retrievabilityBefore === undefined
      ? 1
      : Math.min(SPACING_BONUS_CAP, 1 + (1 - input.retrievabilityBefore));
  return Math.round(base * input.score * spacingBonus);
}

/** C: "the rubric self-grade maps 0 to 3 to s of 0, 0.4, 0.7 and 1." */
export const EXPLAIN_BACK_SELF_GRADE_TO_SCORE: readonly [number, number, number, number] = [
  0, 0.4, 0.7, 1,
];

// ---------------------------------------------------------------------------
// Weekly goal
// ---------------------------------------------------------------------------

export type GoalTier = 'light' | 'steady' | 'deep';

/** C: "Light 150, Steady 300 and Deep 600." */
export const GOAL_XP_BY_TIER: Record<GoalTier, number> = { light: 150, steady: 300, deep: 600 };

const ISO_WEEK_DAY_MS = 86_400_000;

/** The ISO week key (`YYYY-Www`) for a `YYYY-MM-DD` local date. */
export function weekKey(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  // ISO weeks start on Monday; getUTCDay() is 0 (Sun) .. 6 (Sat).
  const isoDayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const thursday = new Date(date.getTime() + (4 - isoDayOfWeek) * ISO_WEEK_DAY_MS);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / ISO_WEEK_DAY_MS + 1) / 7,
  );
  return `${thursday.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/** C: "starts with 1, earns 1 for every 4 met weeks, and can hold at most 2." */
const STARTING_RESERVE = 1;
const MET_WEEKS_PER_EARNED_RESERVE = 4;
const MAX_RESERVE = 2;

export interface WeekRecord {
  readonly weekKey: string;
  readonly xp: number;
  readonly tier: GoalTier;
}

export interface WeeklyGoalSummary {
  readonly run: number;
  readonly bestRun: number;
  readonly reserve: number;
  /** Weeks met since the reserve last reset the "every 4" counter. */
  readonly metWeeksTowardsReserve: number;
  readonly lastWeekMissedWithNoReserve: boolean;
}

/**
 * Folds a learner's week-by-week XP against their tier history into run, best run and
 * rest-week state (C: "Weekly goal"). `weeks` must be in chronological order.
 */
export function applyWeeks(weeks: readonly WeekRecord[]): WeeklyGoalSummary {
  let run = 0;
  let bestRun = 0;
  let reserve = STARTING_RESERVE;
  let metWeeksTowardsReserve = 0;
  let lastWeekMissedWithNoReserve = false;

  for (const week of weeks) {
    const met = week.xp >= GOAL_XP_BY_TIER[week.tier];
    lastWeekMissedWithNoReserve = false;
    if (met) {
      run += 1;
      metWeeksTowardsReserve += 1;
      if (metWeeksTowardsReserve >= MET_WEEKS_PER_EARNED_RESERVE && reserve < MAX_RESERVE) {
        reserve += 1;
        metWeeksTowardsReserve = 0;
      }
    } else if (reserve > 0) {
      // Spend a reserve automatically: the run continues, as if this week were met.
      reserve -= 1;
      run += 1;
    } else {
      lastWeekMissedWithNoReserve = true;
      run = 0;
      metWeeksTowardsReserve = 0;
    }
    bestRun = Math.max(bestRun, run);
  }

  return { run, bestRun, reserve, metWeeksTowardsReserve, lastWeekMissedWithNoReserve };
}

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------

export type Rank = 'reader' | 'tracer' | 'builder' | 'reviewer' | 'engineer' | 'architect';

const RANK_ORDER: readonly Rank[] = [
  'reader',
  'tracer',
  'builder',
  'reviewer',
  'engineer',
  'architect',
];

export interface RankThresholds {
  readonly tracerSolid: number;
  readonly builderSolid: number;
  readonly builderCapstones: number;
  readonly reviewerSolid: number;
  readonly reviewerAiReviewsPassed: number;
  readonly reviewerMaxCalibrationGap: number;
  readonly engineerSolid: number;
  readonly engineerCapstones: number;
  readonly architectSolid: number;
  readonly architectCapstones: number;
  readonly architectIncidents: number;
  readonly architectFluentPerKeyModule: number;
}

/** C's table, capped so Architect never asks for more concepts than the track
 * contains (the doc flags these counts as provisional until content is final). */
export const DEFAULT_RANK_THRESHOLDS: RankThresholds = {
  tracerSolid: 25,
  builderSolid: 60,
  builderCapstones: 3,
  reviewerSolid: 100,
  reviewerAiReviewsPassed: 15,
  reviewerMaxCalibrationGap: 15,
  engineerSolid: 160,
  // One capstone per part, and the course has seven parts: five is the Production part's.
  engineerCapstones: 5,
  architectSolid: 220,
  // Architect asks for every capstone (`totalCapstones`); this is the seven parts' count.
  architectCapstones: 7,
  architectIncidents: 8,
  architectFluentPerKeyModule: 10,
};

export interface RankInput {
  readonly placementDone: boolean;
  readonly solidCount: number;
  readonly capstonesCompleted: number;
  readonly totalCapstones: number;
  readonly aiReviewsPassed: number;
  readonly calibrationGapPoints: number | undefined;
  readonly incidentsResolved: number;
  /** Fluent concept counts for each of the "key" modules (C: "Modules 10, 14, 15, 16"). */
  readonly fluentCountByKeyModule: readonly number[];
  readonly totalConcepts: number;
}

function meetsRank(rank: Rank, input: RankInput, thresholds: RankThresholds): boolean {
  const solidCap = (n: number) => Math.min(n, input.totalConcepts);
  switch (rank) {
    case 'reader':
      return input.placementDone;
    case 'tracer':
      return input.solidCount >= solidCap(thresholds.tracerSolid);
    case 'builder':
      return (
        input.solidCount >= solidCap(thresholds.builderSolid) &&
        input.capstonesCompleted >= thresholds.builderCapstones
      );
    case 'reviewer':
      return (
        input.solidCount >= solidCap(thresholds.reviewerSolid) &&
        input.aiReviewsPassed >= thresholds.reviewerAiReviewsPassed &&
        (input.calibrationGapPoints ?? 0) <= thresholds.reviewerMaxCalibrationGap
      );
    case 'engineer':
      return (
        input.solidCount >= solidCap(thresholds.engineerSolid) &&
        input.capstonesCompleted >= thresholds.engineerCapstones
      );
    case 'architect':
      return (
        input.solidCount >= solidCap(thresholds.architectSolid) &&
        input.capstonesCompleted >= input.totalCapstones &&
        input.incidentsResolved >= thresholds.architectIncidents &&
        input.fluentCountByKeyModule.every(
          (count) => count >= thresholds.architectFluentPerKeyModule,
        )
      );
  }
}

/** Ranks never demote: this returns the highest rank whose requirement is met, given
 * the learner's best-ever inputs (the caller is responsible for tracking a
 * high-water mark, since rank itself is not stored). */
export function rankFor(
  input: RankInput,
  thresholds: RankThresholds = DEFAULT_RANK_THRESHOLDS,
): Rank {
  let achieved: Rank = 'reader';
  for (const rank of RANK_ORDER) {
    if (meetsRank(rank, input, thresholds)) achieved = rank;
  }
  return achieved;
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

/** C: "Certain 0.95, fairly 0.75, guess 0.5", named so the numbers only live in one place. */
export const CONFIDENCE_VALUE = { guess: 0.5, fairly: 0.75, certain: 0.95 } as const;

export interface CalibrationAnswer {
  readonly confidence: keyof typeof CONFIDENCE_VALUE;
  readonly correct: boolean;
  readonly moduleId?: string;
}

/** The minimum sample size before a calibration gap is considered meaningful. */
export const MIN_CALIBRATION_SAMPLE = 5;

export interface CalibrationGapResult {
  readonly gapPoints: number | undefined; // percentage points; undefined below the minimum sample
  readonly sampleSize: number;
}

/** `calibrationGap` = mean stated confidence - accuracy, in percentage points. */
export function calibrationGap(answers: readonly CalibrationAnswer[]): CalibrationGapResult {
  if (answers.length < MIN_CALIBRATION_SAMPLE) {
    return { gapPoints: undefined, sampleSize: answers.length };
  }
  const meanConfidence =
    answers.reduce((sum, a) => sum + CONFIDENCE_VALUE[a.confidence], 0) / answers.length;
  const accuracy = answers.filter((a) => a.correct).length / answers.length;
  return { gapPoints: Math.round((meanConfidence - accuracy) * 100), sampleSize: answers.length };
}

/** The same gap, grouped by module. Modules under the minimum sample are omitted. */
export function calibrationGapByModule(
  answers: readonly CalibrationAnswer[],
): Record<string, CalibrationGapResult> {
  const byModule = new Map<string, CalibrationAnswer[]>();
  for (const answer of answers) {
    if (answer.moduleId === undefined) continue;
    const list = byModule.get(answer.moduleId) ?? [];
    list.push(answer);
    byModule.set(answer.moduleId, list);
  }
  const result: Record<string, CalibrationGapResult> = {};
  for (const [moduleId, moduleAnswers] of byModule) {
    const gap = calibrationGap(moduleAnswers);
    if (gap.gapPoints !== undefined) result[moduleId] = gap;
  }
  return result;
}

/** C: "certain-and-wrong answers flagged for same-session re-test" (hypercorrection). */
export function isHypercorrectionCandidate(answer: CalibrationAnswer): boolean {
  return answer.confidence === 'certain' && !answer.correct;
}

/**
 * B6: "If the transfer result disagrees with the self-grade three times running,
 * show 'Your self-grades run high.'" A disagreement is when the transfer question's
 * correctness does not match what the self-grade implied (self-grade >= 0.7 implies
 * "should transfer correctly"; below that implies "should not").
 */
const SELF_GRADE_RUNS_HIGH_STREAK = 3;
const SELF_GRADE_PASS_THRESHOLD = 0.7;

export interface SelfGradeCheck {
  readonly selfGradeScore: number; // 0, 0.4, 0.7 or 1, via EXPLAIN_BACK_SELF_GRADE_TO_SCORE
  readonly transferCorrect: boolean;
}

export function selfGradesRunHigh(recentChecks: readonly SelfGradeCheck[]): boolean {
  if (recentChecks.length < SELF_GRADE_RUNS_HIGH_STREAK) return false;
  const lastThree = recentChecks.slice(-SELF_GRADE_RUNS_HIGH_STREAK);
  return lastThree.every(
    (check) => check.selfGradeScore >= SELF_GRADE_PASS_THRESHOLD && !check.transferCorrect,
  );
}
