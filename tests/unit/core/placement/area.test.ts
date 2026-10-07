import { describe, expect, it } from 'vitest';
import { areaLevel, runAreaSearch, startAreaSearch, stepAreaSearch } from '@/core/placement/area';

describe('startAreaSearch', () => {
  it('starts on the asked level, inside the scale', () => {
    expect(startAreaSearch(2).level).toBe(2);
    expect(startAreaSearch(0).level).toBe(1);
    expect(startAreaSearch(9).level).toBe(3);
  });
});

describe('stepAreaSearch, one item per level', () => {
  it('climbs on a shown answer', () => {
    const state = stepAreaSearch(startAreaSearch(1), true);
    expect(state.passed).toBe(1);
    expect(state.level).toBe(2);
    expect(state.done).toBe(false);
  });

  it('drops on a miss', () => {
    const state = stepAreaSearch(startAreaSearch(2), false);
    expect(state.failed).toBe(2);
    expect(state.level).toBe(1);
  });

  it('stops once a passed level sits right under a failed one', () => {
    const state = runAreaSearch(1, [true, false]);
    expect(state.done).toBe(true);
    expect(areaLevel(state)).toBe(1);
    expect(state.asked).toBe(2);
  });

  it('stops at the top after passing every level', () => {
    const state = runAreaSearch(1, [true, true, true]);
    expect(state.done).toBe(true);
    expect(areaLevel(state)).toBe(3);
  });

  it('stops at the bottom after missing level 1', () => {
    const state = runAreaSearch(1, [false]);
    expect(state.done).toBe(true);
    expect(areaLevel(state)).toBe(0);
  });

  it('drops from a confident start and settles where the learner holds', () => {
    const state = runAreaSearch(2, [false, true]);
    expect(state.done).toBe(true);
    expect(areaLevel(state)).toBe(1);
  });

  it('never asks more than one item per level', () => {
    for (const start of [1, 2, 3]) {
      for (const answers of [
        [true, true, true],
        [false, false, false],
        [true, false, true],
        [false, true, false],
      ]) {
        const state = runAreaSearch(start, answers);
        expect(state.done).toBe(true);
        expect(state.asked).toBeLessThanOrEqual(3);
      }
    }
  });

  it('changes nothing once done', () => {
    const done = runAreaSearch(1, [false]);
    expect(stepAreaSearch(done, true)).toBe(done);
  });
});

describe('stepAreaSearch, two items per level', () => {
  it('needs two shown answers to pass a level', () => {
    let state = startAreaSearch(1, 2);
    state = stepAreaSearch(state, true);
    expect(state.passed).toBe(0);
    expect(state.level).toBe(1);
    state = stepAreaSearch(state, true);
    expect(state.passed).toBe(1);
    expect(state.level).toBe(2);
  });

  it('fails a level on a miss', () => {
    const state = runAreaSearch(1, [true, false], 2);
    expect(state.done).toBe(true);
    expect(areaLevel(state)).toBe(0);
  });

  it('asks at most six items', () => {
    const state = runAreaSearch(1, [true, true, true, true, true, true, true], 2);
    expect(state.asked).toBe(6);
    expect(areaLevel(state)).toBe(3);
  });
});
