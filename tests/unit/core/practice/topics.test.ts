import { describe, expect, it } from 'vitest';
import { buildSession, sessionSize, type BuildSessionInput } from '@/core/practice/session';
import type { Catalog, CatalogRecallCard, CatalogSkillItem } from '@/core/practice/catalog';
import { initialProgressState, type ProgressState } from '@/core/progress/reducer';
import type { CardState } from '@/core/scheduling/card-state';

/*
 * A practice session for chosen topics (LEARNING-SCIENCE.md B2, "Practice by topic"): due
 * items of those topics first, then first looks at lessons not taken yet, interleaved
 * across the topics.
 */

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

const state = (overrides: Partial<ProgressState> = {}): ProgressState => ({
  ...initialProgressState(),
  ...overrides,
});

function skill(lessonId: string, stepId: string, type = 'multiple-choice', difficulty = 2) {
  return { lessonId, stepId, type, concept: lessonId, difficulty } satisfies CatalogSkillItem;
}
function recall(lessonId: string, cardId: string): CatalogRecallCard {
  return { lessonId, cardId, concept: lessonId };
}

/** Three Python lessons and three algorithms lessons, plus a JavaScript one, in course order. */
const lessons = ['python.a', 'python.b', 'python.c', 'algo.a', 'algo.b', 'algo.c', 'js.a'];
const catalog: Catalog = {
  concepts: lessons.map((id) => ({ id, moduleId: id.split('.')[0] ?? id })),
  skillItems: lessons.flatMap((id) => [
    skill(id, 'hard', 'predict-output', 4),
    skill(id, 'easy', 'multiple-choice', 1),
    skill(id, 'code', 'code-challenge', 1),
    skill(id, 'lab', 'lab', 1),
    skill(id, 'parsons', 'parsons', 2),
  ]),
  recallCards: lessons.map((id) => recall(id, 'card-1')),
};

function build(overrides: Partial<BuildSessionInput> = {}) {
  return buildSession({
    state: state(),
    catalog,
    now,
    minutes: 10,
    device: 'desktop',
    seed: 7,
    ...overrides,
  });
}

const lessonOf = (cardKey: string) => /^(?:lesson|skill):([^#]+)#/.exec(cardKey)?.[1] ?? '';
const moduleOf = (cardKey: string) => lessonOf(cardKey).split('.')[0];

describe('buildSession with topics', () => {
  it('behaves as before when no topics are chosen', () => {
    const withoutTopics = build();
    expect(build({ topics: [] })).toEqual(withoutTopics);
    expect(withoutTopics.items.some((i) => i.source === 'first-look')).toBe(false);
  });

  it('offers first looks at lessons not taken yet, only from the chosen topics', () => {
    const { items } = build({ topics: ['python'] });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.source === 'first-look')).toBe(true);
    expect(items.every((i) => moduleOf(i.cardKey) === 'python')).toBe(true);
  });

  it('takes only steps that make sense without the lesson, and never a typing step on a phone', () => {
    const desktop = build({ topics: ['python', 'algorithms'] }).items;
    const phone = build({ topics: ['python', 'algorithms'], device: 'phone' }).items;
    for (const items of [desktop, phone]) {
      expect(items.some((i) => i.cardKey.endsWith('#code'))).toBe(false);
      expect(items.some((i) => i.cardKey.endsWith('#lab'))).toBe(false);
    }
  });

  it('starts each topic at its earliest untaken lesson, with the easiest items first', () => {
    const { items } = build({ topics: ['python'] });
    expect(items.slice(0, 2).map((i) => i.cardKey)).toEqual([
      'skill:python.a#easy',
      'lesson:python.a#card-1',
    ]);
    // Two items per lesson, so the session reaches past the first lesson.
    expect(items[2]?.cardKey).toBe('skill:python.b#easy');
  });

  it('skips lessons already done and items already seen', () => {
    const { items } = build({
      topics: ['python'],
      state: state({
        completedLessons: new Set(['python.a']),
        cards: { 'skill:python.b#easy': card({ due: '2026-12-01T00:00:00.000Z' }) },
      }),
    });
    const firstLooks = items.filter((i) => i.source === 'first-look');
    expect(firstLooks.some((i) => lessonOf(i.cardKey) === 'python.a')).toBe(false);
    expect(items.some((i) => i.cardKey === 'skill:python.b#easy')).toBe(false);
    expect(items[0]?.cardKey).toBe('skill:python.b#parsons');
  });

  it('interleaves the chosen topics', () => {
    const { items } = build({ topics: ['python', 'algorithms'] });
    const modules = items.map((i) => moduleOf(i.cardKey));
    expect(new Set(modules)).toEqual(new Set(['python', 'algo']));
    for (let i = 1; i < modules.length; i += 1) expect(modules[i]).not.toBe(modules[i - 1]);
  });

  it('puts due items of the chosen topics first and leaves the other topics out', () => {
    const { items } = build({
      topics: ['python'],
      state: state({
        cards: {
          'lesson:python.c#card-1': card({ stability: 1 }),
          'lesson:js.a#card-1': card({ stability: 1 }),
          'signal:x#1': card({ stability: 1 }),
        },
        cardConcept: { 'lesson:python.c#card-1': 'python.c', 'lesson:js.a#card-1': 'js.a' },
      }),
    });
    expect(items[0]).toEqual({
      source: 'due',
      concept: 'python.c',
      cardKey: 'lesson:python.c#card-1',
    });
    expect(items.filter((i) => i.source === 'due')).toHaveLength(1);
    expect(items.some((i) => i.cardKey === 'lesson:js.a#card-1')).toBe(false);
  });

  it('leaves room for first looks when much is due, and lets due items fill what is left', () => {
    const many = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`lesson:python.z${i}#card-1`, card()]),
    );
    const busy = build({ topics: ['python'], state: state({ cards: many }) }).items;
    const size = sessionSize(10);
    expect(busy).toHaveLength(size);
    expect(busy.filter((i) => i.source === 'due')).toHaveLength(Math.round(size * 0.6));
    expect(busy.slice(0, Math.round(size * 0.6)).every((i) => i.source === 'due')).toBe(true);

    const allTaken = build({
      topics: ['python'],
      state: state({ cards: many, completedLessons: new Set(lessons) }),
    }).items;
    expect(allTaken).toHaveLength(size);
    expect(allTaken.every((i) => i.source === 'due')).toBe(true);
  });

  it('practises lessons already done when nothing is due and nothing is new', () => {
    const { items } = build({
      topics: ['algorithms'],
      state: state({ completedLessons: new Set(lessons) }),
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.source === 'interleave' && moduleOf(i.cardKey) === 'algo')).toBe(
      true,
    );
  });

  it('is sized to the minutes and never repeats an item', () => {
    const big: Catalog = {
      ...catalog,
      skillItems: Array.from({ length: 60 }, (_, i) =>
        skill(`python.l${String(i).padStart(2, '0')}`, 'q'),
      ),
    };
    for (const minutes of [5, 10, 20] as const) {
      const { items } = build({ topics: ['python'], catalog: big, minutes });
      expect(items).toHaveLength(sessionSize(minutes));
      expect(new Set(items.map((i) => i.cardKey)).size).toBe(items.length);
    }
  });

  it('counts a lesson shared by two topics once', () => {
    const shared: Catalog = {
      concepts: [],
      skillItems: [skill('cs.a', 'easy', 'multiple-choice', 1)],
      recallCards: [recall('cs.a', 'card-1')],
    };
    const { items } = build({ topics: ['basics', 'algorithms'], catalog: shared });
    expect(items.map((i) => i.cardKey)).toEqual(['skill:cs.a#easy', 'lesson:cs.a#card-1']);
  });

  it('returns nothing, with the next due date, when the topics have nothing to offer', () => {
    const result = build({
      topics: ['ai'],
      state: state({ cards: { 'lesson:python.a#card-1': card({ due: '2026-10-01T00:00:00.000Z' }) } }),
    });
    expect(result.items).toEqual([]);
    expect(result.nextDueDate).toBe('2026-10-01T00:00:00.000Z');
  });

  it('is deterministic for a fixed seed', () => {
    const input = { topics: ['python', 'algorithms'] as const, state: state() };
    expect(build({ ...input, topics: [...input.topics] })).toEqual(
      build({ ...input, topics: [...input.topics] }),
    );
  });
});

describe('buildSession for chapters', () => {
  it('keeps to the chosen chapters, interleaved, with first looks at what is not done', () => {
    const { items } = build({ chapters: ['python', 'js'] });
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((i) => moduleOf(i.cardKey)))).toEqual(new Set(['python', 'js']));
    expect(items[0]?.cardKey).toBe('skill:python.a#easy');
    expect(items[1]?.cardKey).toBe('skill:js.a#easy');
  });

  it('wins over topics, since a stage is narrower than an interest', () => {
    const { items } = build({ chapters: ['js'], topics: ['python'] });
    expect(items.every((i) => moduleOf(i.cardKey) === 'js')).toBe(true);
  });

  it('puts due items of the chapter first', () => {
    const { items } = build({
      chapters: ['algo'],
      state: state({ cards: { 'skill:algo.b#hard': card(), 'skill:python.a#hard': card() } }),
    });
    expect(items[0]?.cardKey).toBe('skill:algo.b#hard');
    expect(items.some((i) => i.cardKey === 'skill:python.a#hard')).toBe(false);
  });
});
