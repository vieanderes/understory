import { describe, expect, it } from 'vitest';
import {
  answerPlacement,
  currentPlacementItem,
  moduleStateOf,
  placementLength,
  placementProgress,
  plannedModules,
  startPlacement,
  undoPlacement,
  type PlacementAreaSpec,
  type PlacementMode,
  type PlacementSession,
} from '@/core/placement';
import type { Confidence } from '@/core/progress';

/** Two areas: web with three modules, data with two. Each module: two core, two deep. */
const AREAS: PlacementAreaSpec[] = [
  { id: 'web', modules: ['html', 'css', 'js'], quick: ['html', 'js'] },
  { id: 'data', modules: ['sql', 'cache'], quick: ['sql', 'cache'] },
].map((a) => ({
  id: a.id,
  quick: a.quick,
  modules: a.modules.map((m) => ({
    id: m,
    core: [0, 1].map((i) => ({ id: `${m}-core-${i}`, concept: `${m}.c${i}` })),
    deep: [0, 1].map((i) => ({ id: `${m}-deep-${i}`, concept: `${m}.d${i}` })),
  })),
}));

const start = (mode: PlacementMode = 'balanced', areas = ['web', 'data']) =>
  startPlacement({ areas, mode });

function answer(session: PlacementSession, correct: boolean, confidence: Confidence = 'fairly') {
  const item = currentPlacementItem(session, AREAS);
  if (!item) throw new Error('No item to answer');
  return answerPlacement(session, AREAS, { itemId: item.id, correct, confidence });
}

/** Answers until the session ends, each answer decided by the item. */
function runBy(
  session: PlacementSession,
  decide: (itemId: string) => [boolean, Confidence?],
): { session: PlacementSession; asked: string[] } {
  const asked: string[] = [];
  let s = session;
  for (let item = currentPlacementItem(s, AREAS); item; item = currentPlacementItem(s, AREAS)) {
    asked.push(item.id);
    const [correct, confidence = 'fairly'] = decide(item.id);
    s = answerPlacement(s, AREAS, { itemId: item.id, correct, confidence });
  }
  return { session: s, asked };
}

describe('plannedModules', () => {
  it('takes the areas in turn, so the topics mix, in the same order for everyone', () => {
    expect(plannedModules(start(), AREAS).map((p) => p.moduleId)).toEqual([
      'html',
      'sql',
      'css',
      'cache',
      'js',
    ]);
  });

  it('keeps to the areas chosen', () => {
    expect(plannedModules(start('balanced', ['data']), AREAS).map((p) => p.moduleId)).toEqual([
      'sql',
      'cache',
    ]);
  });

  it('asks only the quick modules in the quick check', () => {
    expect(plannedModules(start('quick'), AREAS).map((p) => p.moduleId)).toEqual([
      'html',
      'sql',
      'js',
      'cache',
    ]);
  });

  it('keeps course order whatever order the areas were picked in', () => {
    const picked = startPlacement({ areas: ['data', 'web'], mode: 'balanced' });
    expect(plannedModules(picked, AREAS)[0]?.moduleId).toBe('html');
  });
});

describe('a module in the balanced check', () => {
  it('asks the first core question, then the first deep one after a right answer', () => {
    let session = start('balanced', ['data']);
    expect(currentPlacementItem(session, AREAS)).toMatchObject({
      id: 'sql-core-0',
      role: 'core',
      areaId: 'data',
      moduleId: 'sql',
    });
    session = answer(session, true);
    expect(currentPlacementItem(session, AREAS)).toMatchObject({ id: 'sql-deep-0', role: 'deep' });
  });

  it('moves on after a miss on the core question: the module is a gap', () => {
    let session = start('balanced', ['data']);
    session = answer(session, false);
    expect(currentPlacementItem(session, AREAS)?.id).toBe('cache-core-0');
    expect(moduleStateOf(session, AREAS, 'sql')).toBe('gap');
  });

  it('counts a right guess as not shown', () => {
    let session = start('balanced', ['data']);
    session = answer(session, true, 'guess');
    expect(moduleStateOf(session, AREAS, 'sql')).toBe('gap');
  });

  it('calls a module strong on a certain deep answer, with no second one', () => {
    const { session, asked } = runBy(start('balanced', ['data']), (id) =>
      id.startsWith('sql') ? [true, 'certain'] : [false],
    );
    expect(asked.filter((id) => id.startsWith('sql'))).toEqual(['sql-core-0', 'sql-deep-0']);
    expect(moduleStateOf(session, AREAS, 'sql')).toBe('strong');
  });

  it('confirms a deep answer that was not certain with the second deep question', () => {
    let session = start('balanced', ['data']);
    session = answer(session, true);
    session = answer(session, true, 'fairly');
    expect(currentPlacementItem(session, AREAS)?.id).toBe('sql-deep-1');
    expect(moduleStateOf(answer(session, true), AREAS, 'sql')).toBe('strong');
    expect(moduleStateOf(answer(session, false), AREAS, 'sql')).toBe('known');
  });

  it('calls a module known when the deep question is missed', () => {
    let session = start('balanced', ['data']);
    session = answer(session, true);
    session = answer(session, false);
    expect(moduleStateOf(session, AREAS, 'sql')).toBe('known');
    expect(currentPlacementItem(session, AREAS)?.moduleId).toBe('cache');
  });

  it('has no state for a module not reached yet', () => {
    expect(moduleStateOf(start(), AREAS, 'cache')).toBeUndefined();
  });
});

describe('a module in the thorough check', () => {
  it('needs both core questions before it asks a deep one', () => {
    let session = start('thorough', ['data']);
    session = answer(session, true);
    expect(currentPlacementItem(session, AREAS)?.id).toBe('sql-core-1');
    session = answer(session, true);
    expect(currentPlacementItem(session, AREAS)?.id).toBe('sql-deep-0');
  });

  it('stops at a gap when the first core question is missed', () => {
    let session = start('thorough', ['data']);
    session = answer(session, false);
    expect(moduleStateOf(session, AREAS, 'sql')).toBe('gap');
    expect(currentPlacementItem(session, AREAS)?.moduleId).toBe('cache');
  });

  it('asks both deep questions, even after a certain answer', () => {
    let session = start('thorough', ['data']);
    session = answer(session, true);
    session = answer(session, true);
    session = answer(session, true, 'certain');
    expect(currentPlacementItem(session, AREAS)?.id).toBe('sql-deep-1');
  });
});

describe('placementLength', () => {
  it('runs from one question a module to three, or four when thorough', () => {
    expect(placementLength(start('balanced'), AREAS)).toEqual({ fewest: 5, most: 15 });
    expect(placementLength(start('thorough'), AREAS)).toEqual({ fewest: 5, most: 20 });
    expect(placementLength(start('quick'), AREAS)).toEqual({ fewest: 4, most: 12 });
  });
});

describe('placementProgress', () => {
  it('lowers the ceiling as modules settle early', () => {
    let session = start('balanced', ['data']);
    expect(placementProgress(session, AREAS)).toEqual({ asked: 0, maxItems: 6 });
    session = answer(session, false);
    expect(placementProgress(session, AREAS)).toEqual({ asked: 1, maxItems: 4 });
  });
});

describe('answerPlacement', () => {
  it('ignores an answer to anything but the current item', () => {
    const session = start();
    const same = answerPlacement(session, AREAS, {
      itemId: 'js-deep-1',
      correct: true,
      confidence: 'certain',
    });
    expect(same).toBe(session);
  });

  it('records the area, module and role of the answer', () => {
    const session = answer(start('balanced', ['data']), true, 'certain');
    expect(session.answers[0]).toEqual({
      itemId: 'sql-core-0',
      areaId: 'data',
      moduleId: 'sql',
      role: 'core',
      correct: true,
      confidence: 'certain',
    });
  });

  it('is done when every planned module is settled', () => {
    const { session } = runBy(start('quick', ['data']), () => [false]);
    expect(currentPlacementItem(session, AREAS)).toBeNull();
  });
});

describe('undoPlacement', () => {
  it('brings back the last item where it was asked', () => {
    const session = answer(start(), true);
    const back = undoPlacement(session);
    expect(back.answers).toHaveLength(0);
    expect(currentPlacementItem(back, AREAS)?.id).toBe('html-core-0');
  });

  it('does nothing before the first answer', () => {
    const session = start();
    expect(undoPlacement(session)).toBe(session);
  });
});
