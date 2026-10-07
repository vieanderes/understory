import { describe, expect, it } from 'vitest';
import {
  answerPlacement,
  currentPlacementItem,
  defaultRatings,
  placementProgress,
  startPlacement,
  undoPlacement,
  type AreaRating,
  type PlacementAreaSpec,
  type PlacementSession,
} from '@/core/placement';

/** Three areas, three levels each, three items per level. */
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

function answer(session: PlacementSession, correct: boolean, confidence = 'fairly' as const) {
  const item = currentPlacementItem(session, AREAS);
  if (!item) throw new Error('No item to answer');
  return answerPlacement(session, AREAS, { itemId: item.id, correct, confidence });
}

describe('defaultRatings', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('starts someone new on the first area only', () => {
    expect(defaultRatings('new', ids)).toEqual({
      a: 'some',
      b: 'new',
      c: 'new',
      d: 'new',
      e: 'new',
    });
  });

  it('starts someone who builds with AI on the first three areas', () => {
    expect(defaultRatings('ai-builder', ids)).toEqual({
      a: 'some',
      b: 'some',
      c: 'some',
      d: 'new',
      e: 'new',
    });
  });

  it('checks every area for someone experienced, the first two from the middle', () => {
    expect(defaultRatings('experienced', ids)).toEqual({
      a: 'confident',
      b: 'confident',
      c: 'some',
      d: 'some',
      e: 'some',
    });
  });
});

describe('currentPlacementItem', () => {
  it('skips areas rated new and starts on the level the rating sets', () => {
    const session = startPlacement({ ratings: ratings('new', 'confident', 'some') });
    expect(currentPlacementItem(session, AREAS)).toEqual({
      id: 'lang-2-x',
      areaId: 'lang',
      level: 2,
      concept: 'langm.l2',
      moduleId: 'langm',
    });
  });

  it('moves to the next area when one is settled', () => {
    let session = startPlacement({ ratings: ratings('some', 'some') });
    session = answer(session, false);
    expect(currentPlacementItem(session, AREAS)?.areaId).toBe('lang');
  });

  it('rotates items by attempt, so a retake opens on another snippet', () => {
    const first = startPlacement({ ratings: ratings('some'), attempt: 0 });
    const second = startPlacement({ ratings: ratings('some'), attempt: 1 });
    expect(currentPlacementItem(first, AREAS)?.id).toBe('web-1-x');
    expect(currentPlacementItem(second, AREAS)?.id).toBe('web-1-y');
  });

  it('never repeats an item at one level', () => {
    let session = startPlacement({ ratings: ratings('some'), itemsToPass: 2 });
    session = answer(session, true);
    expect(currentPlacementItem(session, AREAS)?.id).toBe('web-1-y');
  });

  it('ends an area whose level has no unseen item left', () => {
    const thin: PlacementAreaSpec[] = [
      { ...AREAS[0]!, levels: AREAS[0]!.levels.map((l) => ({ ...l, items: l.items.slice(0, 1) })) },
    ];
    let session = startPlacement({ ratings: { web: 'some' }, itemsToPass: 2 });
    const item = currentPlacementItem(session, thin)!;
    session = answerPlacement(session, thin, {
      itemId: item.id,
      correct: true,
      confidence: 'certain',
    });
    expect(currentPlacementItem(session, thin)).toBeNull();
  });

  it('is null when every area is rated new', () => {
    expect(currentPlacementItem(startPlacement({ ratings: ratings() }), AREAS)).toBeNull();
  });

  it('checks only the one area of an area run', () => {
    let session = startPlacement({ ratings: ratings('some', 'some', 'some'), scope: 'data' });
    expect(currentPlacementItem(session, AREAS)?.areaId).toBe('data');
    session = answer(session, false);
    expect(currentPlacementItem(session, AREAS)).toBeNull();
  });
});

describe('answerPlacement', () => {
  it('ignores an answer to anything but the current item', () => {
    const session = startPlacement({ ratings: ratings('some') });
    const same = answerPlacement(session, AREAS, {
      itemId: 'web-3-z',
      correct: true,
      confidence: 'certain',
    });
    expect(same).toBe(session);
  });

  it('does not move up on a right guess, but records it as right', () => {
    let session = startPlacement({ ratings: ratings('some', 'some') });
    session = answer(session, true, 'guess' as never);
    expect(session.answers[0]).toMatchObject({ correct: true, confidence: 'guess' });
    expect(currentPlacementItem(session, AREAS)?.areaId).toBe('lang');
  });
});

describe('placementProgress', () => {
  it('counts areas to check, the one under way and the most items left', () => {
    let session = startPlacement({ ratings: ratings('some', 'some') });
    expect(placementProgress(session, AREAS)).toEqual({
      areaIndex: 0,
      areaCount: 2,
      asked: 0,
      maxItems: 6,
    });
    session = answer(session, false);
    expect(placementProgress(session, AREAS)).toMatchObject({ areaIndex: 1, asked: 1 });
  });
});

describe('undoPlacement', () => {
  it('brings back the last item where it was asked', () => {
    let session = startPlacement({ ratings: ratings('some', 'some') });
    session = answer(session, false);
    const back = undoPlacement(session);
    expect(back.answers).toHaveLength(0);
    expect(currentPlacementItem(back, AREAS)?.id).toBe('web-1-x');
  });

  it('does nothing before the first answer', () => {
    const session = startPlacement({ ratings: ratings('some') });
    expect(undoPlacement(session)).toBe(session);
  });
});
