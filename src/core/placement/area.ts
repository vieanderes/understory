/*
 * The search within one placement area (LEARNING-SCIENCE.md B1). An area has three
 * levels. The search is a bracket: the highest level shown and the lowest level missed
 * close in on each other, and it stops when they touch, so a quick check asks at most one
 * item per level. The longer check of one area asks for two shown answers per level,
 * which halves the chance that a lucky pick moves the learner up.
 */

export const AREA_LEVELS = 3;

export interface AreaSearch {
  /** The highest level shown, 0 when none is. */
  readonly passed: number;
  /** The lowest level missed, one above the top when none is. */
  readonly failed: number;
  /** The level the next item is asked at. */
  readonly level: number;
  /** Shown answers at the current level so far. */
  readonly shownHere: number;
  readonly itemsToPass: number;
  readonly asked: number;
  readonly done: boolean;
}

export function startAreaSearch(startLevel: number, itemsToPass = 1): AreaSearch {
  return {
    passed: 0,
    failed: AREA_LEVELS + 1,
    level: Math.min(AREA_LEVELS, Math.max(1, startLevel)),
    shownHere: 0,
    itemsToPass,
    asked: 0,
    done: false,
  };
}

/**
 * Applies one answer. `shown` is a right answer the learner did not mark as a guess: a
 * lucky guess is evidence of nothing, so it does not move anyone up.
 */
export function stepAreaSearch(state: AreaSearch, shown: boolean): AreaSearch {
  if (state.done) return state;
  const asked = state.asked + 1;

  if (!shown) {
    const failed = state.level;
    const next = state.level - 1;
    return settle({ ...state, failed, asked, shownHere: 0 }, next);
  }

  const shownHere = state.shownHere + 1;
  if (shownHere < state.itemsToPass) return { ...state, shownHere, asked };
  const passed = state.level;
  return settle({ ...state, passed, asked, shownHere: 0 }, state.level + 1);
}

/** Moves to `next`, or stops when it is outside the bracket or the scale. */
function settle(state: AreaSearch, next: number): AreaSearch {
  const open = next > state.passed && next < state.failed && next >= 1 && next <= AREA_LEVELS;
  return open ? { ...state, level: next } : { ...state, done: true };
}

/** The level the area is placed at: the highest one shown. */
export function areaLevel(state: AreaSearch): number {
  return state.passed;
}

/** Folds a recorded sequence of answers, stopping where the search itself stops. */
export function runAreaSearch(
  startLevel: number,
  answers: readonly boolean[],
  itemsToPass = 1,
): AreaSearch {
  let state = startAreaSearch(startLevel, itemsToPass);
  for (const shown of answers) {
    if (state.done) break;
    state = stepAreaSearch(state, shown);
  }
  return state;
}
