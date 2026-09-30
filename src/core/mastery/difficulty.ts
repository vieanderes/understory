/*
 * Difficulty, item selection and mode choice (LEARNING-SCIENCE.md B5).
 */

// ---------------------------------------------------------------------------
// Elo-style difficulty
// ---------------------------------------------------------------------------

/** B5: "the item rating is b = 800 + 200 * d." */
const BASE_RATING = 800;
const RATING_PER_DIFFICULTY = 200;

/** Author-seeded difficulty `d` (1..5) to an item rating `b`. */
export function itemRating(d: number): number {
  return BASE_RATING + RATING_PER_DIFFICULTY * d;
}

/** The Elo scale factor: 400 rating points is one order of magnitude of odds. */
const ELO_SCALE = 400;

/** B5: "p = 1 / (1 + 10^((b - theta) / 400))." */
export function expectedSuccess(theta: number, d: number): number {
  const b = itemRating(d);
  return 1 / (1 + Math.pow(10, (b - theta) / ELO_SCALE));
}

/** B5: "theta += 24 * (s - p)." Item ratings stay fixed; only the learner's theta moves. */
const THETA_K = 24;

export function updateTheta(theta: number, score: number, p: number): number {
  return theta + THETA_K * (score - p);
}

// ---------------------------------------------------------------------------
// Target band
// ---------------------------------------------------------------------------

export interface TargetBand {
  readonly low: number;
  readonly high: number;
}

/** B5: "The selector prefers items with p in 0.70 to 0.90." */
export const DEFAULT_TARGET_BAND: TargetBand = { low: 0.7, high: 0.9 };

/** B5: "If a session's running first-try rate goes above 0.9 it raises the target band
 * by one step, and below 0.65 it lowers it." */
const RUNNING_RATE_UPPER = 0.9;
const RUNNING_RATE_LOWER = 0.65;
/** The doc names the trigger thresholds but not the step size; 0.1 is the simplest
 * choice that keeps the band's own width (0.70-0.90) and stays inside [0, 1] for a
 * couple of shifts (chosen reading, recorded in docs/LEARNING-SCIENCE.md). */
const BAND_SHIFT_STEP = 0.1;

function clampBand(band: TargetBand): TargetBand {
  return {
    low: Math.min(Math.max(band.low, 0), 1),
    high: Math.min(Math.max(band.high, 0), 1),
  };
}

export function shiftTargetBand(band: TargetBand, runningFirstTryRate: number): TargetBand {
  if (runningFirstTryRate > RUNNING_RATE_UPPER) {
    return clampBand({ low: band.low + BAND_SHIFT_STEP, high: band.high + BAND_SHIFT_STEP });
  }
  if (runningFirstTryRate < RUNNING_RATE_LOWER) {
    return clampBand({ low: band.low - BAND_SHIFT_STEP, high: band.high - BAND_SHIFT_STEP });
  }
  return band;
}

/** How well an item's predicted success `p` fits inside a target band: 0 at the
 * centre, growing outward. Used by the session builder to rank candidate items. */
export function bandFit(p: number, band: TargetBand): number {
  if (p >= band.low && p <= band.high) return 0;
  return p < band.low ? band.low - p : p - band.high;
}

// ---------------------------------------------------------------------------
// Mode choice
// ---------------------------------------------------------------------------

export type Mode = 'guided' | 'challenge-first';

/** B5: "Challenge-first if the mean mastery of the module's prerequisite concepts is
 * at least 0.7, or p on the module's opening problem is at least 0.5." */
const PREREQUISITE_MASTERY_THRESHOLD = 0.7;
const OPENING_PROBLEM_P_THRESHOLD = 0.5;

export interface ModeForInput {
  readonly prerequisiteMasteryMean: number;
  readonly openingProblemP: number;
  /** The learner's own choice always wins (B5: "The learner can always override."). */
  readonly override?: Mode;
}

/** Ties go to Guided (B5), matching the expertise-reversal asymmetry: helping a
 * novice gains more than withholding help from an expert costs (Tetzlaff et al. 2025). */
export function modeFor(input: ModeForInput): Mode {
  if (input.override) return input.override;
  const qualifies =
    input.prerequisiteMasteryMean >= PREREQUISITE_MASTERY_THRESHOLD ||
    input.openingProblemP >= OPENING_PROBLEM_P_THRESHOLD;
  return qualifies ? 'challenge-first' : 'guided';
}

// ---------------------------------------------------------------------------
// Promotion and demotion offers
// ---------------------------------------------------------------------------

/** B5: "Two consecutive lessons with first-try at least 85% and zero hints." */
const PROMOTION_FIRST_TRY_RATE = 0.85;
const PROMOTION_STREAK = 2;

export interface LessonAttemptStats {
  readonly firstTryRate: number;
  readonly hintsUsed: number;
}

/** True once the most recent `PROMOTION_STREAK` lessons all qualify. Offers Guided
 * modules a switch to Challenge-first; never forces it. */
export function promotionOffered(recentLessons: readonly LessonAttemptStats[]): boolean {
  if (recentLessons.length < PROMOTION_STREAK) return false;
  const lastTwo = recentLessons.slice(-PROMOTION_STREAK);
  return lastTwo.every(
    (lesson) => lesson.firstTryRate >= PROMOTION_FIRST_TRY_RATE && lesson.hintsUsed === 0,
  );
}

/** B5: "Two consolidation checks below 50% triggers an offer of Guided." */
const DEMOTION_SCORE_THRESHOLD = 0.5;
const DEMOTION_STREAK = 2;

export function demotionOffered(recentConsolidationScores: readonly number[]): boolean {
  if (recentConsolidationScores.length < DEMOTION_STREAK) return false;
  const lastTwo = recentConsolidationScores.slice(-DEMOTION_STREAK);
  return lastTwo.every((score) => score < DEMOTION_SCORE_THRESHOLD);
}
