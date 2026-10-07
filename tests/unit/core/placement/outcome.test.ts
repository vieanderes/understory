import { describe, expect, it } from 'vitest';
import {
  answerPlacement,
  currentPlacementItem,
  focusArea,
  overallLevel,
  placementOutcome,
  startPlacement,
  thetaForLevel,
  type AreaRating,
  type PlacementAreaSpec,
  type PlacementSession,
} from '@/core/placement';

const AREAS: PlacementAreaSpec[] = ['web', 'lang', 'data'].map((id) => ({
  id,
  modules: [`${id}m`, `${id}n`],
  levels: [1, 2, 3].map((level) => ({
    level,
    concepts: [`${id}m.l${level}`, `${id}n.l${level}`],
    items: ['x', 'y', 'z'].map((suffix, i) => ({
      id: `${id}-${level}-${suffix}`,
      concept: i === 1 ? `${id}n.l${level}` : `${id}m.l${level}`,
    })),
  })),
}));

const ratings = (...values: AreaRating[]) =>
  Object.fromEntries(AREAS.map((a, i) => [a.id, values[i] ?? 'new']));

function run(session: PlacementSession, answers: boolean[]) {
  let s = session;
  for (const correct of answers) {
    const item = currentPlacementItem(s, AREAS);
    if (!item) break;
    s = answerPlacement(s, AREAS, { itemId: item.id, correct, confidence: 'fairly' });
  }
  return s;
}

describe('thetaForLevel', () => {
  it('rises with the level and stays on the item scale', () => {
    const thetas = [0, 1, 2, 3].map((l) => thetaForLevel(l));
    expect(thetas).toEqual([...thetas].sort((a, b) => a - b));
    expect(thetas[0]).toBe(1000);
    expect(thetas[3]).toBe(1800);
  });

  it('takes a step off for a module the learner missed', () => {
    expect(thetaForLevel(2, true)).toBeLessThan(thetaForLevel(2));
    expect(thetaForLevel(0, true)).toBe(1000);
  });
});

describe('placementOutcome', () => {
  it('gives each checked area its own level, and new areas level 0', () => {
    // web: pass 1, pass 2, miss 3 -> 2. lang: miss 1 -> 0. data is rated new.
    const session = run(startPlacement({ ratings: ratings('some', 'some') }), [
      true,
      true,
      false,
      false,
    ]);
    const outcome = placementOutcome(session, AREAS);
    expect(outcome.levelByArea).toEqual({ web: 2, lang: 0, data: 0 });
    expect(outcome.checked).toEqual(['web', 'lang']);
  });

  it('rates only the modules of checked areas', () => {
    const session = run(startPlacement({ ratings: ratings('some') }), [true, false]);
    const outcome = placementOutcome(session, AREAS);
    expect(Object.keys(outcome.thetaByModule).sort()).toEqual(['webm', 'webn']);
    expect(outcome.thetaByModule.webm).toBeLessThan(outcome.thetaByModule.webn!);
  });

  it('assumes the concepts of passed levels, never one answered wrong', () => {
    const session = run(startPlacement({ ratings: ratings('some') }), [true, true, false]);
    const outcome = placementOutcome(session, AREAS);
    expect(outcome.assumedConcepts).toEqual(['webm.l1', 'webn.l1', 'webm.l2', 'webn.l2']);
    expect(outcome.unassumedConcepts).toEqual(['webm.l3', 'webn.l3']);
  });

  it('keeps a missed concept out of the assumed ones', () => {
    // Start at 2: miss web-2-x (webm.l2), then pass level 1.
    const session = run(startPlacement({ ratings: ratings('confident') }), [false, true]);
    const outcome = placementOutcome(session, AREAS);
    expect(outcome.levelByArea.web).toBe(1);
    expect(outcome.assumedConcepts).toEqual(['webm.l1', 'webn.l1']);
    expect(outcome.unassumedConcepts).toContain('webm.l2');
  });

  it('reports only the one area of an area run', () => {
    const session = run(startPlacement({ ratings: {}, scope: 'lang', itemsToPass: 2 }), [
      true,
      true,
      false,
    ]);
    const outcome = placementOutcome(session, AREAS);
    expect(outcome.scope).toBe('lang');
    expect(outcome.levelByArea).toEqual({ lang: 1 });
  });
});

describe('overallLevel', () => {
  it('adds the area levels over every area', () => {
    expect(overallLevel({ web: 3, lang: 2 }, ['web', 'lang', 'data'])).toEqual({
      score: 5,
      max: 9,
      stage: 'working',
    });
  });

  it('names four stages by share of the maximum', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(overallLevel({}, ids).stage).toBe('starting');
    expect(overallLevel({ a: 3, b: 1 }, ids).stage).toBe('building');
    expect(overallLevel({ a: 3, b: 3, c: 2 }, ids).stage).toBe('working');
    expect(overallLevel({ a: 3, b: 3, c: 3, d: 3 }, ids).stage).toBe('strong');
  });
});

describe('focusArea', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('is the first area below Working in course order', () => {
    const r = { a: 'some', b: 'some', c: 'some', d: 'some' } as const;
    expect(focusArea(ids, { a: 3, b: 2, c: 1, d: 0 }, r)).toBe('c');
  });

  it('passes over later areas the learner rated new', () => {
    const r = { a: 'some', b: 'some', c: 'new', d: 'some' } as const;
    expect(focusArea(ids, { a: 3, b: 2, c: 0, d: 1 }, r)).toBe('d');
  });

  it('never passes over the first two areas, which the rest build on', () => {
    const r = { a: 'new', b: 'some', c: 'some', d: 'some' } as const;
    expect(focusArea(ids, { a: 0, b: 3 }, r)).toBe('a');
  });

  it('falls back to the weakest area not yet advanced', () => {
    const r = { a: 'some', b: 'some', c: 'new', d: 'new' } as const;
    expect(focusArea(ids, { a: 3, b: 2 }, r)).toBe('b');
  });

  it('is undefined when every considered area is advanced', () => {
    const r = { a: 'some', b: 'some', c: 'new', d: 'new' } as const;
    expect(focusArea(ids, { a: 3, b: 3 }, r)).toBeUndefined();
  });
});

describe('edges', () => {
  it('clamps a level outside the scale', () => {
    expect(thetaForLevel(9)).toBe(thetaForLevel(3));
    expect(thetaForLevel(-1)).toBe(thetaForLevel(0));
  });

  it('has no stage to speak of without areas', () => {
    expect(overallLevel({}, [])).toEqual({ score: 0, max: 0, stage: 'starting' });
  });

  it('picks the first of two equally weak areas', () => {
    const r = { a: 'some', b: 'some', c: 'some' } as const;
    expect(focusArea(['a', 'b', 'c'], { a: 2, b: 2, c: 3 }, r)).toBe('a');
  });

  it('treats an area with no rating as new', () => {
    expect(focusArea(['a', 'b', 'c'], { a: 3, b: 3, c: 0 }, {})).toBeUndefined();
  });
});
