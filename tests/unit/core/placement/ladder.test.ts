import { describe, expect, it } from 'vitest';
import { initialLadderState, runLadder, stepLadder } from '@/core/placement/ladder';

describe('stepLadder', () => {
  it('does not move on a single correct answer', () => {
    const state = stepLadder(initialLadderState(3), true);
    expect(state.rung).toBe(3);
    expect(state.correctStreak).toBe(1);
  });

  it('moves up two rungs after two correct answers in a row', () => {
    let state = initialLadderState(3);
    state = stepLadder(state, true);
    state = stepLadder(state, true);
    expect(state.rung).toBe(5);
    expect(state.correctStreak).toBe(0);
  });

  it('moves down one rung on a wrong answer', () => {
    const state = stepLadder(initialLadderState(3), false);
    expect(state.rung).toBe(2);
  });

  it('never drops below rung 1', () => {
    const state = stepLadder(initialLadderState(1), false);
    expect(state.rung).toBe(1);
  });

  it('resets the correct streak after a wrong answer', () => {
    let state = initialLadderState(3);
    state = stepLadder(state, true);
    state = stepLadder(state, false);
    expect(state.correctStreak).toBe(0);
  });

  it('counts a reversal when direction changes from up to down', () => {
    let state = initialLadderState(3);
    state = stepLadder(state, true);
    state = stepLadder(state, true); // up
    state = stepLadder(state, false); // down: reversal 1
    expect(state.reversals).toBe(1);
  });

  it('stops after three reversals', () => {
    let state = initialLadderState(5);
    const answers = [true, true, false, true, true, false, true, true, false];
    for (const a of answers) {
      state = stepLadder(state, a);
    }
    expect(state.done).toBe(true);
    expect(state.stopReason).toBe('reversals');
  });

  it('stops after 10 items even with no reversals', () => {
    let state = initialLadderState(1);
    // alternate single-correct/no-streak answers that never reverse: all correct pairs
    const answers = Array.from({ length: 12 }, () => true);
    for (const a of answers) {
      state = stepLadder(state, a);
    }
    expect(state.done).toBe(true);
    expect(state.stopReason).toBe('items');
    expect(state.itemsAnswered).toBe(10);
  });

  it('is a no-op once done', () => {
    let state = initialLadderState(1);
    for (let i = 0; i < 10; i += 1) state = stepLadder(state, true);
    expect(state.done).toBe(true);
    const after = stepLadder(state, false);
    expect(after).toBe(state);
  });
});

describe('a ladder with a top rung', () => {
  it('starts no higher than the top', () => {
    expect(initialLadderState(7, 4).rung).toBe(4);
  });

  it('stops a climb at the top', () => {
    let state = initialLadderState(3, 4);
    state = stepLadder(state, true, 4);
    state = stepLadder(state, true, 4);
    expect(state.rung).toBe(4);
    expect(state.lastDirection).toBe('up');
  });
});

describe('runLadder', () => {
  it('folds a recorded sequence and stops itself early', () => {
    const answers = [true, true, true, true, true, true, true, true, true, true, true, true];
    const state = runLadder(1, answers);
    expect(state.itemsAnswered).toBe(10);
  });
});
