import { describe, expect, it } from 'vitest';
import {
  answerPlacement,
  currentPlacementItem,
  placementOutcome,
  START_RUNG,
  startPlacement,
  thetaForBand,
  undoPlacement,
  type PlacementRungSpec,
  type PlacementSession,
} from '@/core/placement';

/** Five rungs, three items each, one module per rung except rung 3 which carries two. */
const RUNGS: PlacementRungSpec[] = [1, 2, 3, 4, 5].map((rung) => ({
  rung,
  moduleBand: rung === 3 ? ['m3', 'shared'] : rung === 5 ? ['m5', 'shared'] : [`m${rung}`],
  concepts: [`m${rung}.a`, `m${rung}.b`],
  items: ['x', 'y', 'z'].map((suffix, i) => ({
    id: `r${rung}-${suffix}`,
    concept: i === 1 ? `m${rung}.b` : `m${rung}.a`,
  })),
}));

function answer(session: PlacementSession, correct: boolean): PlacementSession {
  const item = currentPlacementItem(session, RUNGS);
  if (!item) throw new Error('No item to answer');
  return answerPlacement(session, RUNGS, { itemId: item.id, correct, confidence: 'fairly' });
}

describe('startPlacement', () => {
  it('starts each kind of learner on their own rung', () => {
    expect(startPlacement('new').ladder.rung).toBe(START_RUNG.new);
    expect(startPlacement('ai-builder').ladder.rung).toBe(START_RUNG['ai-builder']);
    expect(startPlacement('experienced').ladder.rung).toBe(START_RUNG.experienced);
    expect(START_RUNG.new).toBe(1);
    expect(START_RUNG.new).toBeLessThan(START_RUNG['ai-builder']);
    expect(START_RUNG['ai-builder']).toBeLessThan(START_RUNG.experienced);
  });

  it('never starts above the top rung', () => {
    const short = RUNGS.slice(0, 2);
    const session = startPlacement('experienced', 0, short.length);
    expect(session.ladder.rung).toBe(2);
    expect(currentPlacementItem(session, short)?.rung).toBe(2);
  });
});

describe('currentPlacementItem', () => {
  it('offers the first item of the current rung', () => {
    const item = currentPlacementItem(startPlacement('new'), RUNGS);
    expect(item).toEqual({ id: 'r1-x', rung: 1, concept: 'm1.a', moduleId: 'm1' });
  });

  it('never repeats an item within one session', () => {
    let session = startPlacement('new');
    session = answer(session, true);
    expect(currentPlacementItem(session, RUNGS)?.id).toBe('r1-y');
  });

  it('shifts the items on a later attempt, so a second ladder meets new snippets', () => {
    expect(currentPlacementItem(startPlacement('new', 1), RUNGS)?.id).toBe('r1-y');
    expect(currentPlacementItem(startPlacement('new', 5), RUNGS)?.id).toBe('r1-z');
  });

  it('is null once the ladder is done', () => {
    let session = startPlacement('new');
    session = answer(session, true);
    session = answer(session, true); // up to 3
    session = answer(session, false); // down to 2, reversal 1
    session = answer(session, true);
    session = answer(session, true); // up to 4, reversal 2
    session = answer(session, false); // down to 3, reversal 3
    expect(session.ladder.done).toBe(true);
    expect(currentPlacementItem(session, RUNGS)).toBeNull();
  });

  it('is null when the current rung has no unseen item left', () => {
    let session = startPlacement('new');
    // Wrong at the bottom stays at rung 1 and never reverses.
    session = answer(session, false);
    session = answer(session, false);
    session = answer(session, false);
    expect(session.answers).toHaveLength(3);
    expect(currentPlacementItem(session, RUNGS)).toBeNull();
  });

  it('is null for a ladder with no rungs', () => {
    expect(currentPlacementItem(startPlacement('new'), [])).toBeNull();
  });
});

describe('answerPlacement', () => {
  it('records the answer with its rung, module and confidence', () => {
    const session = answerPlacement(startPlacement('new'), RUNGS, {
      itemId: 'r1-x',
      correct: true,
      confidence: 'certain',
    });
    expect(session.answers).toEqual([
      {
        itemId: 'r1-x',
        rung: 1,
        concept: 'm1.a',
        moduleId: 'm1',
        correct: true,
        confidence: 'certain',
      },
    ]);
  });

  it('ignores an answer to an item that is not the current one', () => {
    const start = startPlacement('new');
    expect(
      answerPlacement(start, RUNGS, { itemId: 'r4-x', correct: true, confidence: 'guess' }),
    ).toBe(start);
  });

  it('clamps the climb at the top rung', () => {
    let session = startPlacement('experienced'); // rung 5 of 5
    session = answer(session, true);
    session = answer(session, true);
    expect(session.ladder.rung).toBe(5);
    expect(session.ladder.lastDirection).toBe('up');
  });
});

describe('placementOutcome', () => {
  it('assumes every concept on the rungs below the final one', () => {
    let session = startPlacement('new');
    session = answer(session, true);
    session = answer(session, true); // up to 3
    const outcome = placementOutcome(session, RUNGS);
    expect(outcome.finalRung).toBe(3);
    expect(outcome.assumedConcepts).toEqual(['m1.a', 'm1.b', 'm2.a', 'm2.b']);
  });

  it('does not assume a concept the learner got wrong', () => {
    let session = startPlacement('ai-builder', 0, RUNGS.length); // rung 3
    session = answer(session, false); // r3-x (m3.a) wrong, down to 2
    session = answer(session, true);
    session = answer(session, true); // up to 4
    session = answer(session, true);
    session = answer(session, true); // up to 5 (clamped from 6)
    const outcome = placementOutcome(session, RUNGS);
    expect(outcome.finalRung).toBe(5);
    expect(outcome.assumedConcepts).not.toContain('m3.a');
    expect(outcome.assumedConcepts).toContain('m3.b');
    expect(outcome.assumedConcepts).toContain('m4.a');
  });

  it('gives every banded module a theta relative to the final rung', () => {
    let session = startPlacement('ai-builder'); // rung 3
    session = answer(session, true);
    session = answer(session, false); // down to 2
    const outcome = placementOutcome(session, RUNGS);
    expect(outcome.finalRung).toBe(2);
    expect(outcome.thetaByModule).toEqual({
      m1: thetaForBand(2, 1),
      m2: thetaForBand(2, 2),
      m3: thetaForBand(2, 3),
      m4: thetaForBand(2, 4),
      m5: thetaForBand(2, 5),
      // A module in two bands is rated by the higher one.
      shared: thetaForBand(2, 5),
    });
  });

  it('says why the ladder stopped', () => {
    expect(placementOutcome(startPlacement('new'), RUNGS).stopReason).toBe('exhausted');
    let session = startPlacement('new');
    for (let i = 0; i < 3; i += 1) session = answer(session, false);
    expect(placementOutcome(session, RUNGS).stopReason).toBe('exhausted');
  });

  it('reports the ladder’s own stop reason when it has one', () => {
    let session = startPlacement('new');
    session = answer(session, true);
    session = answer(session, true);
    session = answer(session, false);
    session = answer(session, true);
    session = answer(session, true);
    session = answer(session, false);
    expect(placementOutcome(session, RUNGS).stopReason).toBe('reversals');
  });
});

describe('thetaForBand', () => {
  it('rates a module in the middle of its scale when its band is the final rung', () => {
    expect(thetaForBand(4, 4)).toBe(1400);
  });

  it('rates modules below the final rung higher, and above it lower, within the item scale', () => {
    expect(thetaForBand(4, 3)).toBe(1600);
    expect(thetaForBand(4, 1)).toBe(1800);
    expect(thetaForBand(4, 5)).toBe(1200);
    expect(thetaForBand(4, 10)).toBe(1000);
  });
});

describe('undoPlacement', () => {
  it('takes back the last answer and shows that item again, on the ladder as it was', () => {
    let session = startPlacement('new');
    session = answer(session, true);
    const before = session;
    const asked = currentPlacementItem(session, RUNGS);
    session = answer(session, false);
    const undone = undoPlacement(session, RUNGS.length);
    expect(undone).toEqual(before);
    expect(currentPlacementItem(undone, RUNGS)).toEqual(asked);
  });

  it('reopens a finished ladder', () => {
    let session = startPlacement('new');
    for (const correct of [true, true, false, true, true, false])
      session = answer(session, correct);
    expect(session.ladder.done).toBe(true);
    expect(undoPlacement(session, RUNGS.length).ladder.done).toBe(false);
  });

  it('changes nothing before the first answer', () => {
    const start = startPlacement('new');
    expect(undoPlacement(start, RUNGS.length)).toEqual(start);
  });
});
