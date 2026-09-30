import { describe, expect, it } from 'vitest';
import { conceptView, dueSummary, overview, weekView } from '@/core/insight';
import type { CatalogFile } from '@/core/practice';
import {
  makeEvent,
  reduce,
  type EventType,
  type PayloadOf,
  type StoryEvent,
} from '@/core/progress';
import { schedule } from '@/core/scheduling';

const catalog: CatalogFile = {
  schema: 1,
  contentRev: 'rev',
  modules: [{ id: 'js', number: 3, slug: 'javascript', title: 'JavaScript' }],
  concepts: [
    {
      id: 'js.coercion',
      moduleId: 'js',
      title: 'Type coercion',
      summary: 'Conversion by an operator.',
    },
    { id: 'js.equality', moduleId: 'js', title: 'Equality', summary: 'Loose and strict.' },
  ],
  lessons: {},
  skillItems: [],
  recallCards: [],
  parts: [],
};

let seq = 0;
function event<T extends EventType>(at: string, type: T, payload: PayloadOf<T>): StoryEvent {
  seq += 1;
  return makeEvent(
    {
      clock: { now: () => new Date(at) },
      ids: { next: () => `01900000-0000-7000-8000-${String(seq).padStart(12, '0')}` },
      deviceId: 'device',
      nextSeq: () => seq,
      contentRev: 'rev',
      localDate: at.slice(0, 10),
    },
    type,
    payload,
  );
}

const answered = (at: string, overrides: Partial<PayloadOf<'step_answered'>> = {}) =>
  event(at, 'step_answered', {
    lessonId: 'js.coercion',
    stepId: 'predict-total',
    stepType: 'predict-output',
    concept: 'js.coercion',
    difficulty: 1,
    tryNumber: 1,
    hintsUsed: 0,
    revealed: false,
    score: 1,
    correct: true,
    mode: 'guided',
    context: 'lesson',
    ...overrides,
  });

const reviewed = (at: string, cardKey: string, concept: string) =>
  event(at, 'review_graded', {
    cardKey,
    concept,
    rating: 3,
    state: schedule(null, 3, new Date(at)),
  });

describe('conceptView', () => {
  it('is unseen with no evidence', () => {
    const view = conceptView(catalog.concepts[0]!, reduce([]), new Date('2026-09-17T10:00:00Z'));
    expect(view.state).toBe('unseen');
    expect(view.mastery).toBe(0);
    expect(view.recall).toBeNull();
    expect(view.nextDue).toBeNull();
  });

  // 0.4 * memory (fresh, so about 1) + 0.6 * P (0.15 after one recognise answer) = 0.49.
  it('is practised after a first answer while memory is fresh, and fades with time', () => {
    const state = reduce([
      answered('2026-09-17T10:00:00Z'),
      reviewed('2026-09-17T10:00:01Z', 'skill:js.coercion#predict-total', 'js.coercion'),
    ]);
    const soon = conceptView(catalog.concepts[0]!, state, new Date('2026-09-17T11:00:00Z'));
    const later = conceptView(catalog.concepts[0]!, state, new Date('2026-10-17T11:00:00Z'));
    expect(soon.state).toBe('practised');
    expect(later.state).toBe('introduced');
    expect(soon.recall).toBeGreaterThan(0.95);
    expect(later.recall).toBeLessThan(soon.recall ?? 0);
    expect(later.mastery).toBeLessThan(soon.mastery);
    expect(later.dueNow).toBe(true);
  });

  it('shows a placement assumption as assumed', () => {
    const state = reduce([
      event('2026-09-17T10:00:00Z', 'placement_completed', {
        startedAs: 'experienced',
        thetaByModule: { js: 1400 },
        assumedConcepts: ['js.equality'],
      }),
    ]);
    expect(conceptView(catalog.concepts[1]!, state, new Date('2026-09-17T10:00:00Z')).state).toBe(
      'assumed',
    );
  });
});

describe('dueSummary', () => {
  it('counts what is due and names the next due instant', () => {
    const state = reduce([
      reviewed('2026-09-01T10:00:00Z', 'lesson:js.coercion#card-1', 'js.coercion'),
      reviewed('2026-09-17T09:59:00Z', 'lesson:js.coercion#card-2', 'js.coercion'),
    ]);
    const due = dueSummary(state, new Date('2026-09-17T10:00:00Z'));
    expect(due.started).toBe(2);
    expect(due.dueNow).toBe(1);
    expect(due.nextDue).not.toBeNull();
  });
});

describe('weekView', () => {
  it('defaults to the steady goal and reports progress', () => {
    const state = reduce([answered('2026-09-16T10:00:00Z')]);
    const week = weekView(state, '2026-09-17');
    expect(week.tier).toBe('steady');
    expect(week.goal).toBe(300);
    expect(week.xpThisWeek).toBeGreaterThan(0);
    expect(week.met).toBe(false);
    expect(week.run).toBe(0);
  });

  it('does not count the unfinished current week as a miss', () => {
    const state = reduce([event('2026-09-17T10:00:00Z', 'goal_tier_set', { tier: 'light' })]);
    const week = weekView(state, '2026-09-17');
    expect(week.lastWeekMissedWithNoReserve).toBe(false);
  });
});

describe('overview', () => {
  it('starts everyone as a reader with nothing due', () => {
    const view = overview(catalog, reduce([]), new Date('2026-09-17T10:00:00Z'), '2026-09-17');
    expect(view.rank).toBe('reader');
    expect(view.started).toBe(false);
    expect(view.due.dueNow).toBe(0);
    expect(view.gaps).toEqual([]);
    expect(view.calibration.gapPoints).toBeUndefined();
  });

  it('knows when the learner has begun', () => {
    const view = overview(
      catalog,
      reduce([answered('2026-09-17T10:00:00Z')]),
      new Date('2026-09-17T10:00:00Z'),
      '2026-09-17',
    );
    expect(view.started).toBe(true);
  });

  it('counts a finished placement as begun, even one that assumed nothing', () => {
    const view = overview(
      catalog,
      reduce([
        event('2026-09-17T10:00:00Z', 'placement_completed', {
          startedAs: 'new',
          thetaByModule: {},
          assumedConcepts: [],
        }),
      ]),
      new Date('2026-09-17T10:00:00Z'),
      '2026-09-17',
    );
    expect(view.started).toBe(true);
  });
});

describe('overview of the parts', () => {
  const withParts: CatalogFile = {
    ...catalog,
    parts: [
      {
        id: 'languages',
        title: 'JavaScript',
        summary: 'You can write JavaScript.',
        modules: ['js'],
        capstone: { title: 'A cart', brief: 'Build a cart.' },
        lessons: ['js.coercion'],
        concepts: ['js.coercion', 'js.equality'],
      },
    ],
  };

  it('derives progress through each part from the log', () => {
    const view = overview(
      withParts,
      reduce([event('2026-09-17T10:00:00Z', 'lesson_completed', { lessonId: 'js.coercion' })]),
      new Date('2026-09-17T10:00:00Z'),
      '2026-09-17',
    );
    expect(view.journey.parts[0]).toMatchObject({
      lessonsDone: 1,
      lessonsTotal: 1,
      complete: true,
    });
    expect(view.journey.current).toBeNull();
    expect(view.journey.checkpoint?.id).toBe('languages');
  });

  it('estimates the time left in each part and in the journey', () => {
    const timed: CatalogFile = {
      ...withParts,
      lessons: {
        'js.coercion': {
          title: 'Coercion',
          moduleId: 'js',
          moduleSlug: 'javascript',
          slug: 'coercion',
          level: 'essential',
          minutes: 12,
          concepts: ['js.coercion'],
          file: 'lessons/js.coercion.json',
        },
      },
    };
    const view = overview(timed, reduce([]), new Date('2026-09-17T10:00:00Z'), '2026-09-17');
    expect(view.time.parts.languages).toMatchObject({ total: 22, left: 22, count: 1 });
    expect(view.time.journey).toMatchObject({ total: 22, left: 22 });
  });

  it('has no journey for a course with no parts', () => {
    const view = overview(catalog, reduce([]), new Date('2026-09-17T10:00:00Z'), '2026-09-17');
    expect(view.journey.parts).toEqual([]);
    expect(view.journey.current).toBeNull();
  });
});
