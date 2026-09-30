import {
  createEmptyCard,
  fsrs,
  FSRS5_DEFAULT_DECAY,
  forgetting_curve,
  State,
  type Card,
  type CardInput,
} from 'ts-fsrs';
import type { Confidence } from '@/core/progress/events';
import type { CardState, FsrsRating } from './card-state';

/*
 * A facade over ts-fsrs (docs/ARCHITECTURE.md "Scheduling"). Fuzz is off and request
 * retention is 0.9, matching LEARNING-SCIENCE.md B4's "review near R = 0.9". CardState
 * is plain JSON (ISO strings, no Date objects), so it can travel inside a
 * `review_graded` event without either client replaying FSRS math.
 */

/** LEARNING-SCIENCE.md B4: "Use ts-fsrs. Check the constants against the wiki." 0.9 is
 * the target retention the whole spaced-repetition design is built around. */
const REQUEST_RETENTION = 0.9;

/** This app reviews on a day-level cadence (`localDate`, whole-day `elapsedDays`), not
 * Anki's minute-scale learning steps, so short-term learning steps are switched off:
 * every rating schedules directly in the day-granularity Review/Relearning states. */
const engine = fsrs({
  request_retention: REQUEST_RETENTION,
  enable_fuzz: false,
  enable_short_term: false,
});

const STATE_TO_LIFECYCLE: Record<State, CardState['state']> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const LIFECYCLE_TO_STATE: Record<CardState['state'], State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

function toFsrsInput(card: CardState): CardInput {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps ?? 0,
    reps: card.reps,
    lapses: card.lapses,
    state: LIFECYCLE_TO_STATE[card.state],
    last_review: card.lastReview ?? null,
  };
}

function fromFsrsCard(card: Card): CardState {
  const state: CardState = {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_LIFECYCLE[card.state],
    scheduledDays: card.scheduled_days,
    elapsedDays: card.elapsed_days,
    learningSteps: card.learning_steps,
  };
  return card.last_review ? { ...state, lastReview: card.last_review.toISOString() } : state;
}

/** Schedules one review. `card` is `null` for a card that has never been reviewed. */
export function schedule(card: CardState | null, rating: FsrsRating, now: Date): CardState {
  const input: CardInput | Card = card === null ? createEmptyCard(now) : toFsrsInput(card);
  const result = engine.next(input, now, rating);
  return fromFsrsCard(result.card);
}

/** Sets a card's stability directly, for the FSRS-4.5 power curve's `S` at `t = 0`.
 * Used for test-out passes, which enter cards at `S = 7` days (LEARNING-SCIENCE.md B5). */
export function seedCard(now: Date, stabilityDays: number, difficulty: number): CardState {
  const empty = createEmptyCard(now);
  return fromFsrsCard({ ...empty, stability: stabilityDays, difficulty, state: State.Review });
}

/** Cards whose `due` has passed, earliest due first. Takes a plain map rather than the
 * full `ProgressState` so scheduling never has to import progress (no import cycle). */
export function dueCards(cards: ReadonlyMap<string, CardState>, now: Date): string[] {
  const nowMs = now.getTime();
  return [...cards.entries()]
    .filter(([, card]) => new Date(card.due).getTime() <= nowMs)
    .sort((a, b) => new Date(a[1].due).getTime() - new Date(b[1].due).getTime())
    .map(([key]) => key);
}

/** R(t, S), FSRS-4.5's forgetting curve: `(1 + (19/81) * t/S)^(-0.5)`, so R = 0.9 at
 * t = S (LEARNING-SCIENCE.md B4). Delegates to ts-fsrs's own implementation rather
 * than re-deriving the constant, per the deliverable brief. */
export function retrievability(stabilityDays: number, elapsedDays: number): number {
  if (stabilityDays <= 0) return 0;
  return forgetting_curve(FSRS5_DEFAULT_DECAY, Math.max(0, elapsedDays), stabilityDays);
}

/** A score of 0 is always "Again"; a perfect, confident first try is "Easy". Anything
 * in between is "Hard" or "Good". FSRS ratings are coarser than the continuous
 * attempt score `s`, so this is the simplest mapping that preserves order (chosen
 * reading recorded in docs/LEARNING-SCIENCE.md Implementation notes). */
const RATING_HARD_CEILING = 0.6; // s below this: struggled, but not a blank miss
const RATING_GOOD_CEILING = 1; // s at exactly 1: a clean, unhinted, first-try success

export function ratingFromScore(score: number, confidence?: Confidence): FsrsRating {
  if (score <= 0) return 1;
  if (score < RATING_HARD_CEILING) return 2;
  if (score < RATING_GOOD_CEILING) return 3;
  return confidence === 'guess' ? 3 : 4;
}
