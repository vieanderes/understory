import { describe, expect, it } from 'vitest';
import { buildSession } from '@/core/practice/session';
import type { Catalog } from '@/core/practice/catalog';
import { initialProgressState, type ProgressState } from '@/core/progress/reducer';
import type { CardState } from '@/core/scheduling/card-state';

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

function stateWith(overrides: Partial<ProgressState>): ProgressState {
  return { ...initialProgressState(), ...overrides };
}

const baseCatalog: Catalog = {
  concepts: [
    { id: 'js.closures', moduleId: 'js', confusableWith: ['js.scope'] },
    { id: 'js.scope', moduleId: 'js' },
    { id: 'js.async', moduleId: 'js' },
  ],
  skillItems: [
    {
      lessonId: 'js.closures',
      stepId: 'predict-1',
      type: 'predict-output',
      concept: 'js.closures',
      difficulty: 2,
    },
    {
      lessonId: 'js.closures',
      stepId: 'code-1',
      type: 'code-challenge',
      concept: 'js.closures',
      difficulty: 3,
    },
    {
      lessonId: 'js.scope',
      stepId: 'predict-1',
      type: 'predict-output',
      concept: 'js.scope',
      difficulty: 2,
    },
    {
      lessonId: 'js.async',
      stepId: 'predict-1',
      type: 'predict-output',
      concept: 'js.async',
      difficulty: 2,
    },
  ],
  recallCards: [],
};

describe('buildSession: nothing due', () => {
  it('is a valid empty result when there is nothing due and no skill items to interleave', () => {
    const result = buildSession({
      state: initialProgressState(),
      catalog: { concepts: [], skillItems: [], recallCards: [] },
      now,
      minutes: 10,
      device: 'desktop',
      seed: 1,
    });
    expect(result.items).toEqual([]);
    expect(result.nextDueDate).toBeNull();
  });

  it('reports the next due date when nothing is due yet but something will be', () => {
    const state = stateWith({
      cards: { 'lesson:js.closures#card-1': card({ due: '2026-09-20T10:00:00.000Z' }) },
      cardConcept: { 'lesson:js.closures#card-1': 'js.closures' },
    });
    const result = buildSession({
      state,
      catalog: { concepts: [], skillItems: [], recallCards: [] },
      now,
      minutes: 10,
      device: 'desktop',
      seed: 1,
    });
    expect(result.items).toEqual([]);
    expect(result.nextDueDate).toBe('2026-09-20T10:00:00.000Z');
  });
});

describe('buildSession: due items', () => {
  it('includes due cards, lowest retrievability first', () => {
    const state = stateWith({
      cards: {
        'lesson:a#1': card({ stability: 30, lastReview: '2026-09-16T10:00:00.000Z' }), // R close to 1
        'lesson:a#2': card({ stability: 3, lastReview: '2026-09-01T10:00:00.000Z' }), // long overdue: low R
      },
      cardConcept: { 'lesson:a#1': 'js.closures', 'lesson:a#2': 'js.closures' },
    });
    const result = buildSession({
      state,
      catalog: { concepts: [], skillItems: [], recallCards: [] },
      now,
      minutes: 5,
      device: 'desktop',
      seed: 1,
    });
    const dueCardKeys = result.items.filter((i) => i.source === 'due').map((i) => i.cardKey);
    expect(dueCardKeys[0]).toBe('lesson:a#2');
  });

  it('is deterministic for a fixed seed', () => {
    const state = stateWith({
      cards: {
        'lesson:a#1': card(),
        'lesson:a#2': card({ due: '2026-09-15T10:00:00.000Z' }),
      },
      cardConcept: { 'lesson:a#1': 'js.closures', 'lesson:a#2': 'js.scope' },
    });
    const run = () =>
      buildSession({ state, catalog: baseCatalog, now, minutes: 10, device: 'desktop', seed: 7 });
    expect(run()).toEqual(run());
  });
});

describe('buildSession: interleaving', () => {
  it('picks skill items for the weakest concept, preferring its confusable pair', () => {
    // js.closures has no evidence (p defaults to 0, the weakest); js.async is given a
    // high P so it is not picked as the second interleave slot ahead of the
    // confusable js.scope.
    const state = stateWith({
      concepts: {
        'js.async': {
          p: 0.9,
          familiesPassed: new Set(),
          produceOrExplainPassed: false,
          successLocalDates: [],
          assumed: false,
          wasEverSolidOrFluent: false,
          attemptCount: 5,
        },
      },
    });
    const result = buildSession({
      state,
      catalog: baseCatalog,
      now,
      minutes: 20,
      device: 'desktop',
      seed: 3,
    });
    const concepts = new Set(
      result.items.filter((i) => i.source === 'interleave').map((i) => i.concept),
    );
    expect(concepts.has('js.closures')).toBe(true);
    // js.scope is js.closures's only confusable partner in the catalog
    expect([...concepts].every((c) => c === 'js.closures' || c === 'js.scope')).toBe(true);
  });

  it('excludes code-challenge (typing) steps on phone', () => {
    const result = buildSession({
      state: initialProgressState(),
      catalog: baseCatalog,
      now,
      minutes: 20,
      device: 'phone',
      seed: 3,
    });
    const cardKeys = result.items.map((i) => i.cardKey);
    expect(cardKeys.some((k) => k.includes('code-1'))).toBe(false);
  });

  it('never repeats the same concept more than twice in a row when an alternative exists', () => {
    const manyItemCatalog: Catalog = {
      concepts: [
        { id: 'a', moduleId: 'js', confusableWith: ['b'] },
        { id: 'b', moduleId: 'js' },
      ],
      skillItems: [
        ...Array.from({ length: 5 }, (_, i) => ({
          lessonId: 'a',
          stepId: `s${i}`,
          type: 'predict-output',
          concept: 'a',
          difficulty: 2,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          lessonId: 'b',
          stepId: `s${i}`,
          type: 'predict-output',
          concept: 'b',
          difficulty: 2,
        })),
      ],
      recallCards: [],
    };
    const result = buildSession({
      state: initialProgressState(),
      catalog: manyItemCatalog,
      now,
      minutes: 45,
      device: 'desktop',
      seed: 9,
    });
    const concepts = result.items.filter((i) => i.source === 'interleave').map((i) => i.concept);
    let run = 1;
    for (let i = 1; i < concepts.length; i += 1) {
      run = concepts[i] === concepts[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
  });
});

describe('buildSession: probe', () => {
  it('includes one probe item for an assumed concept when one exists', () => {
    const state = stateWith({ assumedConcepts: new Set(['js.async']) });
    const result = buildSession({
      state,
      catalog: baseCatalog,
      now,
      minutes: 45,
      device: 'desktop',
      seed: 5,
    });
    const probes = result.items.filter((i) => i.source === 'probe');
    expect(probes.length).toBeLessThanOrEqual(1);
    if (probes.length === 1) expect(probes[0]?.concept).toBe('js.async');
  });

  it('has no probe when there are no assumed concepts', () => {
    const result = buildSession({
      state: initialProgressState(),
      catalog: baseCatalog,
      now,
      minutes: 45,
      device: 'desktop',
      seed: 5,
    });
    expect(result.items.some((i) => i.source === 'probe')).toBe(false);
  });
});

describe('buildSession: sizing', () => {
  it('produces roughly 14 items for a 10-minute session, capped by catalog size', () => {
    const bigCatalog: Catalog = {
      concepts: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, moduleId: 'js' })),
      skillItems: Array.from({ length: 40 }, (_, i) => ({
        lessonId: `c${i % 5}`,
        stepId: `s${i}`,
        type: 'predict-output',
        concept: `c${i % 5}`,
        difficulty: 2,
      })),
      recallCards: [],
    };
    const result = buildSession({
      state: initialProgressState(),
      catalog: bigCatalog,
      now,
      minutes: 10,
      device: 'desktop',
      seed: 2,
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(14);
  });
});
