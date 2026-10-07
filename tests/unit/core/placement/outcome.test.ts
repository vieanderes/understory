import { describe, expect, it } from 'vitest';
import {
  answerPlacement,
  areaLevelOf,
  areaReports,
  currentPlacementItem,
  focusArea,
  overallLevel,
  placementOutcome,
  startPlacement,
  thetaForLevel,
  type PlacementAreaSpec,
  type PlacementMode,
  type PlacementSession,
} from '@/core/placement';
import type { Confidence } from '@/core/progress';

/** web: four modules, data: two. Each item assumes its own concept and a sibling. */
const AREAS: PlacementAreaSpec[] = [
  { id: 'web', modules: ['html', 'css', 'js', 'dom'], quick: ['html', 'js'] },
  { id: 'data', modules: ['sql', 'cache'], quick: ['sql', 'cache'] },
].map((a) => ({
  id: a.id,
  quick: a.quick,
  modules: a.modules.map((m) => ({
    id: m,
    core: [0, 1].map((i) => ({ id: `${m}-core-${i}`, concept: `${m}.c${i}` })),
    deep: [0, 1].map((i) => ({ id: `${m}-deep-${i}`, concept: `${m}.d${i}` })),
    assumes: Object.fromEntries(
      ['core-0', 'core-1', 'deep-0', 'deep-1'].map((k) => [
        `${m}-${k}`,
        [`${m}.${k}`, `${m}.${k}.sibling`],
      ]),
    ),
  })),
}));

/** Answers until the session ends, each answer decided by the item. */
function runBy(
  areas: readonly string[],
  decide: (itemId: string) => [boolean, Confidence?],
  mode: PlacementMode = 'balanced',
): PlacementSession {
  let s = startPlacement({ areas, mode });
  for (let item = currentPlacementItem(s, AREAS); item; item = currentPlacementItem(s, AREAS)) {
    const [correct, confidence = 'fairly'] = decide(item.id);
    s = answerPlacement(s, AREAS, { itemId: item.id, correct, confidence });
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

describe('areaLevelOf', () => {
  it('is Advanced when most modules hold and half are strong', () => {
    expect(areaLevelOf(['strong', 'strong', 'known', 'known'])).toBe(3);
  });

  it('is Working when at least half the modules hold', () => {
    expect(areaLevelOf(['strong', 'known', 'gap', 'gap'])).toBe(2);
    expect(areaLevelOf(['known', 'known', 'known', 'known'])).toBe(2);
  });

  it('is Foundations when some module holds, and New when none does', () => {
    expect(areaLevelOf(['known', 'gap', 'gap'])).toBe(1);
    expect(areaLevelOf(['gap', 'gap'])).toBe(0);
    expect(areaLevelOf([])).toBe(0);
  });
});

describe('placementOutcome', () => {
  it('places only the areas picked, so an earlier result elsewhere stays', () => {
    const session = runBy(['data'], () => [true, 'certain']);
    const outcome = placementOutcome(session, AREAS);
    expect(outcome.levelByArea).toEqual({ data: 3 });
    expect(outcome.checked).toEqual(['data']);
  });

  it('gives each module its state, with the evidence behind it', () => {
    const session = runBy(['data'], (id) =>
      id.startsWith('sql') ? [true, 'certain'] : [false, 'certain'],
    );
    expect(placementOutcome(session, AREAS).modules).toEqual([
      { areaId: 'data', moduleId: 'sql', state: 'strong', right: 2, asked: 2, sureButWrong: 0 },
      { areaId: 'data', moduleId: 'cache', state: 'gap', right: 0, asked: 1, sureButWrong: 1 },
    ]);
  });

  it('rates each module asked by where it stands', () => {
    const session = runBy(['data'], (id) => (id.startsWith('sql') ? [true, 'certain'] : [false]));
    const { thetaByModule } = placementOutcome(session, AREAS);
    expect(thetaByModule.sql).toBe(thetaForLevel(3));
    expect(thetaByModule.cache).toBe(thetaForLevel(0, true));
  });

  it('assumes the lessons of the questions shown, and takes back the rest it asked about', () => {
    // sql: core right, deep missed. cache: core missed.
    const session = runBy(['data'], (id) => [id === 'sql-core-0']);
    const outcome = placementOutcome(session, AREAS);
    expect(outcome.assumedConcepts).toEqual(['sql.core-0', 'sql.core-0.sibling']);
    expect(outcome.unassumedConcepts).toContain('sql.deep-0');
    expect(outcome.unassumedConcepts).toContain('cache.core-0');
    expect(outcome.unassumedConcepts).not.toContain('sql.core-0');
  });

  it('assumes nothing from a right guess', () => {
    const session = runBy(['data'], () => [true, 'guess']);
    expect(placementOutcome(session, AREAS).assumedConcepts).toEqual([]);
  });

  it('leaves the modules a quick check did not ask out of the result', () => {
    const session = runBy(['web'], () => [false], 'quick');
    const outcome = placementOutcome(session, AREAS);
    expect(outcome.modules.map((m) => m.moduleId)).toEqual(['html', 'js']);
    expect(Object.keys(outcome.thetaByModule).sort()).toEqual(['html', 'js']);
  });
});

describe('areaReports', () => {
  it('calls Advanced solid, Working mostly there and below that worth going deeper', () => {
    const session = runBy(['web', 'data'], (id) =>
      id.startsWith('sql') || id.startsWith('cache')
        ? [false]
        : id.startsWith('html') || id.startsWith('css')
          ? [true, 'certain']
          : [id.includes('core'), 'certain'],
    );
    expect(areaReports(session, AREAS).map((r) => [r.areaId, r.level, r.verdict])).toEqual([
      ['web', 3, 'solid'],
      ['data', 0, 'deeper'],
    ]);
  });

  it('adds up the evidence over the modules of an area', () => {
    const session = runBy(['data'], (id) =>
      id === 'sql-core-0' ? [true, 'certain'] : [false, 'certain'],
    );
    expect(areaReports(session, AREAS)[0]).toMatchObject({
      right: 1,
      asked: 3,
      sureButWrong: 2,
      modulesAsked: 2,
      modulesTotal: 2,
    });
  });

  it('says how much of the area a quick check covered', () => {
    const session = runBy(['web'], () => [false], 'quick');
    expect(areaReports(session, AREAS)[0]).toMatchObject({ modulesAsked: 2, modulesTotal: 4 });
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
  it('is the first checked area below Working in course order', () => {
    expect(focusArea(['a', 'b', 'c'], { a: 3, b: 1, c: 0 })).toBe('b');
  });

  it('falls back to the weakest checked area not yet advanced', () => {
    expect(focusArea(['a', 'b'], { a: 3, b: 2 })).toBe('b');
  });

  it('is undefined when every checked area is advanced', () => {
    expect(focusArea(['a', 'b'], { a: 3, b: 3 })).toBeUndefined();
  });
});
