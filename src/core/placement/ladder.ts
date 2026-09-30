/*
 * The first-session placement staircase (LEARNING-SCIENCE.md B1). The reading ladder
 * itself, and which item sits at which rung, is content (out of scope for core). This
 * module is the staircase alone: where it stands after each answer, and when it stops.
 * `session.ts` pairs it with the rungs and items and turns the result into ratings.
 */

/** B1: "It stops at three reversals or 10 items." */
const MAX_REVERSALS = 3;
const MAX_ITEMS = 10;
/** B1: "two correct in a row moves up two rungs, one wrong moves down one." */
const RUNGS_UP_ON_STREAK = 2;
const CORRECT_STREAK_TO_MOVE_UP = 2;
const RUNGS_DOWN_ON_WRONG = 1;
const MIN_RUNG = 1;

export type LadderDirection = 'up' | 'down' | null;

export interface LadderState {
  readonly rung: number;
  readonly correctStreak: number;
  readonly reversals: number;
  readonly itemsAnswered: number;
  readonly lastDirection: LadderDirection;
  readonly done: boolean;
  readonly stopReason: 'reversals' | 'items' | null;
}

export function initialLadderState(
  startRung: number,
  maxRung = Number.POSITIVE_INFINITY,
): LadderState {
  return {
    rung: Math.min(maxRung, Math.max(MIN_RUNG, startRung)),
    correctStreak: 0,
    reversals: 0,
    itemsAnswered: 0,
    lastDirection: null,
    done: false,
    stopReason: null,
  };
}

/** Applies one answered item to the staircase. Pure: the same state and answer
 * always produce the same next state. A climb past `maxRung` stops at the top, and
 * still counts as a move up. */
export function stepLadder(
  state: LadderState,
  correct: boolean,
  maxRung = Number.POSITIVE_INFINITY,
): LadderState {
  if (state.done) return state;

  const itemsAnswered = state.itemsAnswered + 1;

  if (!correct) {
    const direction: LadderDirection = 'down';
    const reversals = state.lastDirection === 'up' ? state.reversals + 1 : state.reversals;
    const rung = Math.max(MIN_RUNG, state.rung - RUNGS_DOWN_ON_WRONG);
    return finish({ rung, correctStreak: 0, reversals, itemsAnswered, lastDirection: direction });
  }

  const correctStreak = state.correctStreak + 1;
  if (correctStreak >= CORRECT_STREAK_TO_MOVE_UP) {
    const direction: LadderDirection = 'up';
    const reversals = state.lastDirection === 'down' ? state.reversals + 1 : state.reversals;
    const rung = Math.min(maxRung, state.rung + RUNGS_UP_ON_STREAK);
    return finish({ rung, correctStreak: 0, reversals, itemsAnswered, lastDirection: direction });
  }

  return finish({
    rung: state.rung,
    correctStreak,
    reversals: state.reversals,
    itemsAnswered,
    lastDirection: state.lastDirection,
  });
}

function finish(state: Omit<LadderState, 'done' | 'stopReason'>): LadderState {
  if (state.reversals >= MAX_REVERSALS) return { ...state, done: true, stopReason: 'reversals' };
  if (state.itemsAnswered >= MAX_ITEMS) return { ...state, done: true, stopReason: 'items' };
  return { ...state, done: false, stopReason: null };
}

/** Folds `stepLadder` over a recorded sequence of correct/incorrect answers, stopping
 * as soon as the staircase itself would stop. */
export function runLadder(startRung: number, answers: readonly boolean[]): LadderState {
  let state = initialLadderState(startRung);
  for (const correct of answers) {
    if (state.done) break;
    state = stepLadder(state, correct);
  }
  return state;
}
