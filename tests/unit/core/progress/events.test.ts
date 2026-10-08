import { describe, expect, it } from 'vitest';
import { fixedClock } from '@/core/ports/clock';
import type { IdGen } from '@/core/ports/id-gen';
import {
  onlineTestSubmittedPayloadSchema,
  pathExamAttemptedPayloadSchema,
  LATEST_VERSION,
  makeEvent,
  reviewGradedEventSchema,
  stepAnsweredEventSchema,
  storyEventSchema,
} from '@/core/progress/events';

function fakeIds(...ids: string[]): IdGen {
  let i = 0;
  return {
    next: () => {
      const id = ids[i];
      i += 1;
      return id ?? `018f0000-0000-7000-8000-${String(i).padStart(12, '0')}`;
    },
  };
}

const baseDeps = {
  clock: fixedClock('2026-09-17T10:00:00Z'),
  ids: fakeIds('018f0e60-0000-7000-8000-000000000001'),
  deviceId: 'device-1',
  nextSeq: () => 1,
  contentRev: 'rev-abc',
  localDate: '2026-09-17',
};

describe('makeEvent', () => {
  it('builds a valid, latest-version envelope', () => {
    const event = makeEvent(baseDeps, 'lesson_completed', { lessonId: 'js.closures' });
    expect(event).toEqual({
      id: '018f0e60-0000-7000-8000-000000000001',
      type: 'lesson_completed',
      v: 1,
      at: '2026-09-17T10:00:00.000Z',
      localDate: '2026-09-17',
      deviceId: 'device-1',
      seq: 1,
      contentRev: 'rev-abc',
      payload: { lessonId: 'js.closures' },
    });
  });

  it("stamps v with the type's latest version", () => {
    const event = makeEvent(baseDeps, 'goal_tier_set', { tier: 'steady' });
    expect(event.v).toBe(LATEST_VERSION.goal_tier_set);
  });

  it('uses the caller-supplied sequence and device id', () => {
    let seq = 5;
    const deps = { ...baseDeps, deviceId: 'device-2', nextSeq: () => (seq += 1) };
    const event = makeEvent(deps, 'lesson_completed', { lessonId: 'js.closures' });
    expect(event.deviceId).toBe('device-2');
    expect(event.seq).toBe(6);
  });

  it('throws when the payload does not satisfy its schema', () => {
    expect(() =>
      makeEvent(baseDeps, 'step_answered', {
        // score is out of range (0..1); this is a runtime zod check, not a type error.
        lessonId: 'js.closures',
        stepId: 'predict-total',
        stepType: 'predict-output',
        concept: 'js.closures',
        difficulty: 3,
        tryNumber: 1,
        hintsUsed: 0,
        revealed: false,
        score: 1.5,
        correct: true,
        mode: 'guided',
        context: 'lesson',
      }),
    ).toThrow();
  });

  it('builds every declared event type without throwing', () => {
    const payloads: Record<keyof typeof LATEST_VERSION, unknown> = {
      placement_answered: {
        itemId: 'html-1',
        moduleId: 'html',
        areaId: 'firstcode',
        level: 1,
        correct: true,
        confidence: 'guess',
      },
      placement_completed: {
        scope: 'all',
        startedAs: 'new',
        levelByArea: { firstcode: 1 },
        thetaByModule: { html: 900 },
        assumedConcepts: ['html.tags'],
        unassumedConcepts: [],
      },
      step_answered: {
        lessonId: 'js.closures',
        stepId: 'predict-total',
        stepType: 'predict-output',
        concept: 'js.closures',
        difficulty: 2,
        tryNumber: 1,
        hintsUsed: 0,
        revealed: false,
        score: 1,
        correct: true,
        mode: 'guided',
        context: 'lesson',
      },
      review_graded: {
        cardKey: 'skill:js.closures#predict-total',
        concept: 'js.closures',
        rating: 3,
        state: {
          due: '2026-09-24T10:00:00.000Z',
          stability: 7,
          difficulty: 5,
          reps: 1,
          lapses: 0,
          state: 'review',
          scheduledDays: 7,
          elapsedDays: 0,
        },
      },
      lesson_completed: { lessonId: 'js.closures' },
      explain_back_graded: {
        lessonId: 'js.closures',
        stepId: 'why',
        concept: 'js.closures',
        rubricHits: 2,
      },
      capstone_completed: { moduleId: 'js' },
      capstone_adr_written: {
        partId: 'servers',
        title: 'Keep sessions in the database',
        decision: 'Sessions live in a table, not in memory.',
      },
      incident_resolved: { incidentId: 'overselling', concept: 'db.transactions', score: 1 },
      test_out_attempted: { moduleId: 'js', score: 0.9, passed: true },
      session_started: {
        sessionId: 's1',
        kind: 'practice',
        minutes: 10,
        device: 'phone',
        seed: 42,
      },
      session_finished: { sessionId: 's1', items: 14 },
      goal_tier_set: { tier: 'light' },
      mode_set: { moduleId: 'js', mode: 'challenge-first' },
      setting_changed: { key: 'notifications', value: true },
      ai_hours_reported: { isoWeek: '2026-W38', withAi: 2, withoutAi: 5 },
      reading_collected: { referenceKey: 'shen-tamkin-2026' },
      path_exam_attempted: {
        pathId: 'coding-rounds',
        seed: 7,
        right: 24,
        total: 28,
        startedAt: '2026-09-29T09:40:00.000Z',
        finishedAt: '2026-09-29T10:00:00.000Z',
        lessonIds: ['js.closures'],
      },
      plan_set: {
        goal: 'interviews',
        level: 'some',
        language: 'js',
        minutesPerWeek: 420,
        deadline: '2026-10-12',
        since: '2026-10-01',
      },
      plan_cleared: {},
      profile_set: { interests: ['web', 'ai'], news: true },
      news_read: { date: '2026-10-05' },
      custom_path_set: {
        pathId: 'own-a1b2c3d4',
        name: 'Backend in six weeks',
        lessonIds: ['js.closures'],
        stages: [
          { title: 'Closures', why: 'Everything builds on them.', lessonIds: ['js.closures'] },
        ],
        pace: { minutesPerWeek: 240, deadline: '2026-11-20' },
        origin: 'scout',
      },
      online_test_submitted: {
        attemptId: 'a1',
        testKey: 'demo',
        title: 'Demo test',
        mode: 'demo',
        minutes: 30,
        startedAt: '2026-09-29T09:40:00.000Z',
        submittedAt: '2026-09-29T10:00:00.000Z',
        reason: 'candidate',
        tasks: [
          {
            taskId: 'lowest-free-ticket',
            language: 'ts',
            type: 'algorithmic',
            correctness: { passed: 5, total: 5 },
            performance: { passed: 2, total: 4 },
            complexity: 'O(N**2)',
          },
        ],
        assistantPrompts: 0,
      },
      words_added: { termIds: ['closure', 'n-plus-one'] },
      words_removed: { termIds: ['closure'] },
      word_reviewed: {
        termId: 'closure',
        drill: 'gap',
        correct: true,
        rating: 3,
        retrievabilityBefore: 0.82,
        state: {
          due: '2026-10-04T09:00:00.000Z',
          stability: 3.1,
          difficulty: 5,
          reps: 1,
          lapses: 0,
          state: 'review',
          scheduledDays: 3,
          elapsedDays: 0,
          lastReview: '2026-10-01T09:00:00.000Z',
        },
        durationMs: 4200,
      },
      word_round_finished: { right: 18, total: 21, seconds: 60, scope: 'deck' },
    };

    for (const type of Object.keys(LATEST_VERSION) as (keyof typeof LATEST_VERSION)[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exercising every branch of a discriminated union generically
      expect(() => makeEvent(baseDeps, type, payloads[type] as any)).not.toThrow();
    }
  });
});

describe('capstone_adr_written', () => {
  const adr = {
    partId: 'servers',
    title: 'Keep sessions in the database',
    context: 'Two server processes must see the same session.',
    decision: 'Sessions live in a table, not in memory.',
    alternatives: 'A signed cookie. An in-memory map.',
    consequences: 'One query per request.',
  };

  it('carries the five parts of a decision record for one part', () => {
    const event = makeEvent(baseDeps, 'capstone_adr_written', adr);
    expect(event.v).toBe(1);
    expect(event.payload).toEqual(adr);
  });

  it('needs a title and a decision, and nothing else', () => {
    expect(() => makeEvent(baseDeps, 'capstone_adr_written', { ...adr, title: '   ' })).toThrow();
    expect(() => makeEvent(baseDeps, 'capstone_adr_written', { ...adr, decision: '' })).toThrow();
    expect(() =>
      makeEvent(baseDeps, 'capstone_adr_written', {
        partId: 'servers',
        title: 'A title',
        decision: 'A decision.',
      }),
    ).not.toThrow();
  });

  it('refuses a blank optional field, which is omitted instead', () => {
    expect(() => makeEvent(baseDeps, 'capstone_adr_written', { ...adr, context: ' ' })).toThrow();
  });

  it('caps the title and each section', () => {
    expect(() =>
      makeEvent(baseDeps, 'capstone_adr_written', { ...adr, title: 'x'.repeat(121) }),
    ).toThrow();
    expect(() =>
      makeEvent(baseDeps, 'capstone_adr_written', { ...adr, consequences: 'x'.repeat(4001) }),
    ).toThrow();
    expect(() =>
      makeEvent(baseDeps, 'capstone_adr_written', { ...adr, consequences: 'x'.repeat(4000) }),
    ).not.toThrow();
  });
});

describe('storyEventSchema', () => {
  it('rejects an envelope with an unknown extra field', () => {
    const event = makeEvent(baseDeps, 'lesson_completed', { lessonId: 'js.closures' });
    const withExtra = { ...event, extra: 'nope' };
    expect(storyEventSchema.safeParse(withExtra).success).toBe(false);
  });

  it('rejects a null optional field (must be omitted, not null)', () => {
    const event = makeEvent(baseDeps, 'step_answered', {
      lessonId: 'js.closures',
      stepId: 'predict-total',
      stepType: 'predict-output',
      concept: 'js.closures',
      difficulty: 2,
      tryNumber: 1,
      hintsUsed: 0,
      revealed: false,
      score: 1,
      correct: true,
      mode: 'guided',
      context: 'lesson',
    });
    const withNull = { ...event, payload: { ...event.payload, confidence: null } };
    expect(stepAnsweredEventSchema.safeParse(withNull).success).toBe(false);
  });

  it('accepts review_graded without retrievabilityBefore for a brand new card', () => {
    const result = reviewGradedEventSchema.safeParse({
      id: '018f0e60-0000-7000-8000-000000000002',
      type: 'review_graded',
      v: 1,
      at: '2026-09-17T10:00:00.000Z',
      localDate: '2026-09-17',
      deviceId: 'device-1',
      seq: 2,
      contentRev: 'rev-abc',
      payload: {
        cardKey: 'lesson:js.closures#card-1',
        concept: 'js.closures',
        rating: 3,
        state: {
          due: '2026-09-24T10:00:00.000Z',
          stability: 7,
          difficulty: 5,
          reps: 1,
          lapses: 0,
          state: 'review',
          scheduledDays: 7,
          elapsedDays: 0,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed cardKey', () => {
    const result = reviewGradedEventSchema.shape.payload.safeParse({
      cardKey: 'not-a-card-key',
      concept: 'js.closures',
      rating: 3,
      state: {
        due: '2026-09-24T10:00:00.000Z',
        stability: 7,
        difficulty: 5,
        reps: 1,
        lapses: 0,
        state: 'review',
        scheduledDays: 7,
        elapsedDays: 0,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('path_exam_attempted', () => {
  const payload = {
    pathId: 'coding-rounds',
    seed: 7,
    right: 24,
    total: 28,
    startedAt: '2026-09-29T09:40:00.000Z',
    finishedAt: '2026-09-29T10:00:00.000Z',
    lessonIds: ['js.closures', 'js.arrays'],
  };
  const parse = (value: unknown) => pathExamAttemptedPayloadSchema.safeParse(value).success;

  it('records the facts of one sitting', () => {
    expect(parse(payload)).toBe(true);
  });

  it('refuses more right answers than items', () => {
    expect(parse({ ...payload, right: 29 })).toBe(false);
  });

  it('refuses a finish before the start', () => {
    expect(parse({ ...payload, finishedAt: '2026-09-29T09:00:00.000Z' })).toBe(false);
  });

  it('refuses a path id that is not lowercase words joined by hyphens', () => {
    expect(parse({ ...payload, pathId: 'Coding Rounds' })).toBe(false);
  });

  it('refuses an exam with no items', () => {
    expect(parse({ ...payload, right: 0, total: 0 })).toBe(false);
  });
});

describe('online_test_submitted', () => {
  const payload = {
    attemptId: 'a1',
    testKey: 'demo',
    title: 'Demo test',
    mode: 'demo',
    minutes: 30,
    startedAt: '2026-09-29T09:40:00.000Z',
    submittedAt: '2026-09-29T10:00:00.000Z',
    reason: 'candidate',
    tasks: [
      {
        taskId: 'lowest-free-ticket',
        language: 'ts',
        type: 'algorithmic',
        correctness: { passed: 5, total: 5 },
        performance: { passed: 2, total: 4 },
        complexity: 'O(N**2)',
      },
    ],
    assistantPrompts: 0,
  };
  const parse = (value: unknown) => onlineTestSubmittedPayloadSchema.safeParse(value).success;

  it('records the tallies of one sitting', () => {
    expect(parse(payload)).toBe(true);
  });

  it('refuses a submission before the start', () => {
    expect(parse({ ...payload, submittedAt: '2026-09-29T09:00:00.000Z' })).toBe(false);
  });

  it('refuses a test with no tasks, or a language the simulator does not run', () => {
    expect(parse({ ...payload, tasks: [] })).toBe(false);
    expect(parse({ ...payload, tasks: [{ ...payload.tasks[0], language: 'java' }] })).toBe(false);
  });
});
