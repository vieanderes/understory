import { describe, expect, it } from 'vitest';
import {
  buildCheckpoint,
  CHECKPOINT_MINUTES,
  TEST_OUT_MINUTES,
  TEST_OUT_PASS_SHARE,
  testOutPassed,
} from '@/core/practice';
import type { Catalog, CatalogSkillItem } from '@/core/practice';
import { initialProgressState, type ConceptRecord, type ProgressState } from '@/core/progress';
import type { CardState } from '@/core/scheduling';

const now = new Date('2026-09-17T10:00:00Z');

function card(overrides: Partial<CardState> = {}): CardState {
  return {
    due: '2026-09-16T10:00:00.000Z',
    stability: 5,
    difficulty: 5,
    reps: 1,
    lapses: 0,
    state: 'review',
    scheduledDays: 5,
    elapsedDays: 5,
    lastReview: '2026-09-11T10:00:00.000Z',
    ...overrides,
  };
}

const record = (p: number): ConceptRecord => ({
  p,
  familiesPassed: new Set(),
  produceOrExplainPassed: false,
  successLocalDates: [],
  assumed: false,
  wasEverSolidOrFluent: false,
  attemptCount: 1,
});

const item = (concept: string, stepId: string, type = 'predict-output'): CatalogSkillItem => ({
  lessonId: concept,
  stepId,
  type,
  concept,
  difficulty: 2,
});

/** Eight concepts in the part, three items each, and one concept outside it. */
const partConcepts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `js.${x}`);
const catalog: Catalog = {
  concepts: [...partConcepts, 'css.outside'].map((id) => ({
    id,
    moduleId: id.split('.')[0] ?? '',
  })),
  skillItems: [...partConcepts, 'css.outside'].flatMap((concept) => [
    item(concept, 'predict-1'),
    item(concept, 'predict-2'),
    item(concept, 'code-1', 'code-challenge'),
  ]),
  recallCards: [],
};

const stateWith = (overrides: Partial<ProgressState>): ProgressState => ({
  ...initialProgressState(),
  ...overrides,
});

const build = (
  state: ProgressState,
  overrides: Partial<Parameters<typeof buildCheckpoint>[0]> = {},
) =>
  buildCheckpoint({
    state,
    catalog,
    concepts: partConcepts,
    now,
    device: 'desktop',
    seed: 7,
    ...overrides,
  });

describe('buildCheckpoint', () => {
  it('is sized for one sitting and holds only the part’s concepts', () => {
    const { items } = build(initialProgressState());
    expect(items).toHaveLength(14);
    expect(items.every((i) => partConcepts.includes(i.concept))).toBe(true);
    expect(new Set(items.map((i) => i.cardKey)).size).toBe(items.length);
  });

  it('mixes the part: every concept appears before any appears twice', () => {
    const { items } = build(initialProgressState());
    const firstRound = items.slice(0, partConcepts.length).map((i) => i.concept);
    expect(new Set(firstRound).size).toBe(partConcepts.length);
    for (let i = 1; i < items.length; i += 1) {
      expect(items[i]?.concept).not.toBe(items[i - 1]?.concept);
    }
  });

  it('starts with the weakest concepts', () => {
    const concepts = Object.fromEntries(partConcepts.map((id) => [id, record(0.9)]));
    concepts['js.f'] = record(0.1);
    concepts['js.c'] = record(0.3);
    const { items } = build(stateWith({ concepts }));
    expect(items.slice(0, 2).map((i) => i.concept)).toEqual(['js.f', 'js.c']);
  });

  it('weighs a concept that is being forgotten, and brings back its due card first', () => {
    const concepts = Object.fromEntries(partConcepts.map((id) => [id, record(0.5)]));
    const state = stateWith({
      concepts,
      cards: {
        'lesson:js.lesson#card-g': card({ stability: 1, lastReview: '2026-09-01T10:00:00.000Z' }),
        'lesson:js.lesson#card-b': card({ stability: 30 }),
      },
      cardConcept: { 'lesson:js.lesson#card-g': 'js.g', 'lesson:js.lesson#card-b': 'js.b' },
    });
    const [first] = build(state).items;
    expect(first).toEqual({ source: 'due', concept: 'js.g', cardKey: 'lesson:js.lesson#card-g' });
  });

  it('leaves out typing on a phone', () => {
    const { items } = build(initialProgressState(), { device: 'phone' });
    expect(items.some((i) => i.cardKey.includes('#code-'))).toBe(false);
  });

  it('is the same session for the same seed', () => {
    expect(build(initialProgressState()).items).toEqual(build(initialProgressState()).items);
  });

  it('is shorter, never padded, when the part has few items', () => {
    const { items } = build(initialProgressState(), { concepts: ['js.a'], device: 'phone' });
    expect(items.map((i) => i.cardKey)).toEqual(['skill:js.a#predict-1', 'skill:js.a#predict-2']);
  });

  it('is empty for a part with nothing to practise, and says when the next card is due', () => {
    const state = stateWith({
      cards: { 'lesson:css.lesson#card-1': card({ due: '2026-09-20T10:00:00.000Z' }) },
      cardConcept: { 'lesson:css.lesson#card-1': 'css.outside' },
    });
    expect(build(state, { concepts: ['js.none'] })).toEqual({
      items: [],
      nextDueDate: '2026-09-20T10:00:00.000Z',
    });
  });

  it('takes a longer sitting for a test-out', () => {
    expect(build(initialProgressState(), { minutes: TEST_OUT_MINUTES }).items).toHaveLength(24);
    expect(CHECKPOINT_MINUTES).toBe(10);
  });
});

describe('testOutPassed', () => {
  it('passes at 80% or more (LEARNING-SCIENCE.md B5)', () => {
    expect(TEST_OUT_PASS_SHARE).toBe(0.8);
    expect(testOutPassed(8, 10)).toBe(true);
    expect(testOutPassed(7, 10)).toBe(false);
    expect(testOutPassed(0, 0)).toBe(false);
  });
});
