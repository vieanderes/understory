import type { FormatFamily } from '@/core/content/schema';
import type { CardState } from '@/core/scheduling/card-state';
import { retrievability } from '@/core/scheduling/fsrs';

/*
 * The mastery model, exactly as specified in LEARNING-SCIENCE.md B4. Every constant
 * below is named after, and cites, the sentence in B4 it comes from.
 */

// ---------------------------------------------------------------------------
// Attempt score
// ---------------------------------------------------------------------------

/** B4: "0.6 for second try." Also used for any later unhinted, unrevealed try, since
 * the doc does not define a third bucket (simplest reading; see Implementation notes). */
const SECOND_TRY_SCORE = 0.6;
/** B4: "1.0 for first try with no hint." */
const FIRST_TRY_SCORE = 1;
/** B4: "max(0.2, 1 - 0.2 * hints) when hints were used." */
const HINT_SCORE_FLOOR = 0.2;
const HINT_SCORE_PER_HINT = 0.2;
/** B4: "0 when the solution was revealed." */
const REVEALED_SCORE = 0;

export interface AttemptInput {
  readonly tryNumber: number;
  readonly hintsUsed: number;
  readonly revealed: boolean;
  readonly correct: boolean;
}

/** The attempt score `s` that feeds both `updateSkill` and FSRS rating selection. A
 * final wrong answer that was neither revealed nor hinted still scores 0: no correct
 * answer was ever produced, so there is nothing to reward (simplest reading). */
export function attemptScore(input: AttemptInput): number {
  if (input.revealed) return REVEALED_SCORE;
  if (!input.correct) return 0;
  if (input.hintsUsed > 0) {
    return Math.max(HINT_SCORE_FLOOR, FIRST_TRY_SCORE - HINT_SCORE_PER_HINT * input.hintsUsed);
  }
  return input.tryNumber <= 1 ? FIRST_TRY_SCORE : SECOND_TRY_SCORE;
}

// ---------------------------------------------------------------------------
// Skill (P)
// ---------------------------------------------------------------------------

/** B4: alpha by format family. Recognise formats change slowest, produce/explain
 * fastest, because a single produce success is stronger evidence than one MC tick. */
export const ALPHA_BY_FAMILY: Record<FormatFamily, number> = {
  recognise: 0.15,
  arrange: 0.25,
  produce: 0.35,
};

/** `P_c <- (1 - alpha) * P_c + alpha * s` (B4). `P` starts at 0 for a concept with no evidence. */
export function updateSkill(p: number, score: number, family: FormatFamily): number {
  const alpha = ALPHA_BY_FAMILY[family];
  return (1 - alpha) * p + alpha * score;
}

/** B5: "Passing at 80% or more marks the module's concepts Practised, with P = 0.7." */
export const TEST_OUT_PASS_SKILL_P = 0.7;
/** B5: "Their FSRS items enter at S = 7 days." */
export const TEST_OUT_INITIAL_STABILITY_DAYS = 7;

// ---------------------------------------------------------------------------
// Memory (M) and mastery
// ---------------------------------------------------------------------------

/** B4: "M_c is the mean R(now) over the concept's items." Cards that have never been
 * reviewed contribute no retrievability evidence yet and are excluded from the mean;
 * an empty or all-unreviewed set of cards has no memory evidence (returns 0). */
export function memoryOf(cards: readonly CardState[], now: Date): number {
  const reviewed = cards.filter((card) => card.lastReview !== undefined);
  if (reviewed.length === 0) return 0;
  const total = reviewed.reduce((sum, card) => {
    const elapsedDays =
      (now.getTime() - new Date(card.lastReview as string).getTime()) / (1000 * 60 * 60 * 24);
    return sum + retrievability(card.stability, elapsedDays);
  }, 0);
  return total / reviewed.length;
}

/** B4: "raw = 0.4 * M_c + 0.6 * P_c." */
const MEMORY_WEIGHT = 0.4;
const SKILL_WEIGHT = 0.6;
/** B4: "mastery is capped at 0.6 until two format families have passed." */
const MID_MASTERY_CAP = 0.6;
const FAMILIES_FOR_MID_CAP = 2;
/** B4: "and at 0.8 until a produce or explain item has passed." */
const HIGH_MASTERY_CAP = 0.8;

export interface ConceptEvidence {
  readonly p: number;
  /** Format families in which at least one attempt has been correct. */
  readonly familiesPassed: ReadonlySet<FormatFamily>;
  /** Whether a produce or explain-back item has ever been correct. */
  readonly produceOrExplainPassed: boolean;
}

/** `mastery_c = min(raw, cap)` (B4). */
export function masteryOf(
  evidence: ConceptEvidence,
  cards: readonly CardState[],
  now: Date,
): number {
  const memory = memoryOf(cards, now);
  const raw = MEMORY_WEIGHT * memory + SKILL_WEIGHT * evidence.p;
  const cap =
    evidence.familiesPassed.size < FAMILIES_FOR_MID_CAP
      ? MID_MASTERY_CAP
      : evidence.produceOrExplainPassed
        ? 1
        : HIGH_MASTERY_CAP;
  return Math.min(raw, cap);
}

// ---------------------------------------------------------------------------
// Mastery state
// ---------------------------------------------------------------------------

export type MasteryState =
  'unseen' | 'assumed' | 'introduced' | 'practised' | 'solid' | 'fluent' | 'gap';

/** B4 table thresholds. Exported so the reducer can detect "was ever Solid or
 * Fluent" for the Gap rule without duplicating the number (Fluent requires mastery
 * >= 0.85, which already clears SOLID_THRESHOLD, so that one flag covers both). */
const PRACTISED_THRESHOLD = 0.4;
export const SOLID_THRESHOLD = 0.7;
const FLUENT_THRESHOLD = 0.85;
/** B4: "Gap: was Solid or Fluent and has fallen below 0.6." */
export const GAP_THRESHOLD = 0.6;
/** B4: "mean stability S at least 21 days." */
export const FLUENT_MIN_MEAN_STABILITY_DAYS = 21;
/** B4: "successes on at least 2 distinct days at least 7 days apart." */
export const FLUENT_MIN_SUCCESS_DAYS = 2;
export const FLUENT_MIN_DAYS_APART = 7;

export interface MasteryStateInput {
  readonly assumed: boolean;
  readonly hasEvidence: boolean;
  readonly wasEverSolidOrFluent: boolean;
  readonly mastery: number;
  readonly meanStabilityDays: number;
  /** True once two success days are recorded at least `FLUENT_MIN_DAYS_APART` apart. */
  readonly fluentSpacingMet: boolean;
}

export function masteryState(input: MasteryStateInput): MasteryState {
  if (input.wasEverSolidOrFluent && input.mastery < GAP_THRESHOLD) return 'gap';
  if (!input.hasEvidence) return input.assumed ? 'assumed' : 'unseen';
  if (
    input.mastery >= FLUENT_THRESHOLD &&
    input.meanStabilityDays >= FLUENT_MIN_MEAN_STABILITY_DAYS &&
    input.fluentSpacingMet
  ) {
    return 'fluent';
  }
  if (input.mastery >= SOLID_THRESHOLD) return 'solid';
  if (input.mastery >= PRACTISED_THRESHOLD) return 'practised';
  return 'introduced';
}

/** Given an ascending list of success dates (YYYY-MM-DD, may repeat), true once two
 * distinct days are at least `FLUENT_MIN_DAYS_APART` apart (Fluent's spacing rule). */
export function hasFluentSpacing(successLocalDates: readonly string[]): boolean {
  const distinctSorted = [...new Set(successLocalDates)].sort();
  if (distinctSorted.length < FLUENT_MIN_SUCCESS_DAYS) return false;
  // The length check above guarantees both ends exist.
  const first = distinctSorted[0]!;
  const last = distinctSorted[distinctSorted.length - 1]!;
  const daysApart =
    (new Date(`${last}T00:00:00Z`).getTime() - new Date(`${first}T00:00:00Z`).getTime()) /
    86_400_000;
  return daysApart >= FLUENT_MIN_DAYS_APART;
}
