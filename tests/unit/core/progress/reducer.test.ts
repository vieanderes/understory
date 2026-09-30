import { describe, expect, it } from 'vitest';
import { fixedClock } from '@/core/ports/clock';
import type { IdGen } from '@/core/ports/id-gen';
import { makeEvent, type StoryEvent } from '@/core/progress/events';
import { applyEvent, initialProgressState, reduce } from '@/core/progress/reducer';
import { mulberry32, shuffle } from '@/core/util/rng';

function idGen(prefix: string): IdGen {
  let i = 0;
  const prefixCode = (prefix.charCodeAt(0) || 0).toString(16).padStart(2, '0');
  return {
    next: () => {
      i += 1;
      const suffix = `${prefixCode}${String(i).padStart(10, '0')}`.slice(-12);
      return `018f0e60-0000-7000-8000-${suffix}`;
    },
  };
}

function depsFor(deviceId: string, at: string, prefix: string) {
  let seq = 0;
  return {
    clock: fixedClock(at),
    ids: idGen(prefix),
    deviceId,
    nextSeq: () => {
      seq += 1;
      return seq;
    },
    contentRev: 'rev-1',
    localDate: at.slice(0, 10),
  };
}

describe('applyEvent', () => {
  const deps = depsFor('device-1', '2026-09-17T10:00:00Z', 'a');

  it('starts from an empty state', () => {
    const state = initialProgressState();
    expect(state.concepts).toEqual({});
    expect(state.xpByLocalDate).toEqual({});
  });

  it("updates a concept's P, families passed and XP on a correct step_answered", () => {
    const event = makeEvent(deps, 'step_answered', {
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
    const state = applyEvent(initialProgressState(), event);
    expect(state.concepts['js.closures']?.p).toBeCloseTo(0.15); // alpha(recognise)=0.15, P0=0
    expect(state.concepts['js.closures']?.familiesPassed.has('recognise')).toBe(true);
    expect(state.xpByLocalDate['2026-09-17']).toBe(4); // predict-mc-fill base 4 * s=1 * spacingBonus=1
  });

  it('does not mark a family passed on an incorrect attempt', () => {
    const event = makeEvent(deps, 'step_answered', {
      lessonId: 'js.closures',
      stepId: 'predict-total',
      stepType: 'predict-output',
      concept: 'js.closures',
      difficulty: 2,
      tryNumber: 1,
      hintsUsed: 0,
      revealed: false,
      score: 0,
      correct: false,
      mode: 'guided',
      context: 'lesson',
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.concepts['js.closures']?.familiesPassed.size).toBe(0);
    expect(state.xpByLocalDate['2026-09-17']).toBeUndefined();
  });

  it('earns half base XP for a wrong challenge-first attempt', () => {
    const event = makeEvent(deps, 'step_answered', {
      lessonId: 'js.closures',
      stepId: 'predict-total',
      stepType: 'code-challenge',
      concept: 'js.closures',
      difficulty: 3,
      tryNumber: 1,
      hintsUsed: 0,
      revealed: false,
      score: 0,
      correct: false,
      mode: 'challenge-first',
      context: 'lesson',
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.xpByLocalDate['2026-09-17']).toBe(8); // 0.5 * 15, rounded
  });

  it('earns 0 XP for the same step within 24 hours (no grinding)', () => {
    const payload = {
      lessonId: 'js.closures',
      stepId: 'predict-total',
      stepType: 'predict-output' as const,
      concept: 'js.closures',
      difficulty: 2,
      tryNumber: 1,
      hintsUsed: 0,
      revealed: false,
      score: 1,
      correct: true,
      mode: 'guided' as const,
      context: 'practice' as const,
    };
    const first = makeEvent(deps, 'step_answered', payload);
    const soonDeps = depsFor('device-1', '2026-09-17T10:30:00Z', 'a');
    const second = makeEvent(soonDeps, 'step_answered', payload);
    let state = initialProgressState();
    state = applyEvent(state, first);
    state = applyEvent(state, second);
    expect(state.xpByLocalDate['2026-09-17']).toBe(4); // only the first attempt earned XP
  });

  it('feeds calibration when confidence is stated', () => {
    const event = makeEvent(deps, 'step_answered', {
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
      confidence: 'certain',
      mode: 'guided',
      context: 'lesson',
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.calibrationAnswers).toEqual([{ confidence: 'certain', correct: true }]);
  });

  it('stores the FSRS card state and awards recall XP for a "lesson:" review', () => {
    const event = makeEvent(deps, 'review_graded', {
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
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.cards['lesson:js.closures#card-1']?.stability).toBe(7);
    expect(state.xpByLocalDate['2026-09-17']).toBe(round07());
    function round07() {
      return Math.round(2 * 0.7 * 1); // recall base 2, rating 3 -> s=0.7, spacingBonus 1 (no R given)
    }
  });

  it('awards no XP for a "skill:" review (XP already came from step_answered)', () => {
    const event = makeEvent(deps, 'review_graded', {
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
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.xpByLocalDate['2026-09-17']).toBeUndefined();
    expect(state.cards['skill:js.closures#predict-total']).toBeDefined();
  });

  it('gives 0 XP for an unscheduled, high-retrievability recall review (no cramming)', () => {
    const event = makeEvent(deps, 'review_graded', {
      cardKey: 'lesson:js.closures#card-1',
      concept: 'js.closures',
      rating: 3,
      retrievabilityBefore: 0.99,
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
    // First review ever: treated as scheduled (no prior card), so it earns XP.
    const afterFirst = applyEvent(initialProgressState(), event);
    expect(afterFirst.xpByLocalDate['2026-09-17']).toBeGreaterThan(0);

    // Re-review far ahead of the due date the state just set: not scheduled.
    const early = makeEvent(depsFor('device-1', '2026-09-18T10:00:00Z', 'b'), 'review_graded', {
      cardKey: 'lesson:js.closures#card-1',
      concept: 'js.closures',
      rating: 3,
      retrievabilityBefore: 0.99,
      state: afterFirst.cards['lesson:js.closures#card-1']!,
    });
    const afterEarly = applyEvent(afterFirst, early);
    expect(afterEarly.xpByLocalDate['2026-09-18']).toBeUndefined();
  });

  it('records a lesson completion', () => {
    const event = makeEvent(deps, 'lesson_completed', { lessonId: 'js.closures' });
    const state = applyEvent(initialProgressState(), event);
    expect(state.completedLessons.has('js.closures')).toBe(true);
  });

  it('grades explain-back with the self-grade score mapping and awards XP', () => {
    const event = makeEvent(deps, 'explain_back_graded', {
      lessonId: 'js.closures',
      stepId: 'why',
      concept: 'js.closures',
      rubricHits: 2,
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.concepts['js.closures']?.p).toBeCloseTo(0.35 * 0.7);
    expect(state.xpByLocalDate['2026-09-17']).toBe(7); // base 10 * s=0.7
  });

  it('marks a concept produce/explain-passed only on a perfect explain-back', () => {
    const okEvent = makeEvent(deps, 'explain_back_graded', {
      lessonId: 'js.closures',
      stepId: 'why',
      concept: 'js.closures',
      rubricHits: 2,
    });
    const okState = applyEvent(initialProgressState(), okEvent);
    expect(okState.concepts['js.closures']?.produceOrExplainPassed).toBe(false);

    const perfectEvent = makeEvent(deps, 'explain_back_graded', {
      lessonId: 'js.closures',
      stepId: 'why',
      concept: 'js.closures',
      rubricHits: 3,
    });
    const perfectState = applyEvent(initialProgressState(), perfectEvent);
    expect(perfectState.concepts['js.closures']?.produceOrExplainPassed).toBe(true);
  });

  it('records a capstone and its XP', () => {
    const event = makeEvent(deps, 'capstone_completed', { moduleId: 'js' });
    const state = applyEvent(initialProgressState(), event);
    expect(state.completedCapstones.has('js')).toBe(true);
    expect(state.xpByLocalDate['2026-09-17']).toBe(100);
  });

  it('records a decision record for a part, and gives it no XP', () => {
    const event = makeEvent(deps, 'capstone_adr_written', {
      partId: 'servers',
      title: 'Keep sessions in the database',
      decision: 'Sessions live in a table.',
      consequences: 'One query per request.',
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.capstoneAdrs.servers).toEqual({
      partId: 'servers',
      title: 'Keep sessions in the database',
      decision: 'Sessions live in a table.',
      consequences: 'One query per request.',
      firstWrittenOn: '2026-09-17',
      updatedOn: '2026-09-17',
      revisions: 1,
    });
    expect(state.xpByLocalDate).toEqual({});
  });

  it('records an incident and its XP', () => {
    const event = makeEvent(deps, 'incident_resolved', {
      incidentId: 'oversell',
      concept: 'db.tx',
      score: 1,
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.resolvedIncidents).toHaveLength(1);
    expect(state.xpByLocalDate['2026-09-17']).toBe(25);
  });

  it('records a passing test-out with its XP, and a failing one with none', () => {
    const pass = makeEvent(deps, 'test_out_attempted', {
      moduleId: 'js',
      score: 0.9,
      passed: true,
    });
    const passState = applyEvent(initialProgressState(), pass);
    expect(passState.xpByLocalDate['2026-09-17']).toBe(60);

    const fail = makeEvent(depsFor('device-1', '2026-09-18T10:00:00Z', 'c'), 'test_out_attempted', {
      moduleId: 'js',
      score: 0.5,
      passed: false,
    });
    const failState = applyEvent(initialProgressState(), fail);
    expect(failState.xpByLocalDate['2026-09-18']).toBeUndefined();
    expect(failState.testOuts.js).toHaveLength(1);
  });

  it('keeps the latest plan, and drops it when cleared', () => {
    const first = makeEvent(deps, 'plan_set', {
      goal: 'from-zero',
      level: 'new',
      language: 'js',
      minutesPerWeek: 140,
      since: '2026-09-17',
    });
    const second = makeEvent(depsFor('device-1', '2026-09-18T10:00:00Z', 'q'), 'plan_set', {
      goal: 'interviews',
      level: 'some',
      language: 'python',
      minutesPerWeek: 420,
      deadline: '2026-10-01',
      since: '2026-09-18',
    });
    expect(reduce([second, first]).plan).toMatchObject({
      goal: 'interviews',
      deadline: '2026-10-01',
    });
    const cleared = makeEvent(depsFor('device-1', '2026-09-19T10:00:00Z', 'r'), 'plan_cleared', {});
    expect(reduce([first, second, cleared]).plan).toBeUndefined();
  });

  it('keeps every online-test sitting as a fact, and grants no XP for it', () => {
    const payload = {
      attemptId: 'a1',
      testKey: 'demo',
      title: 'Demo test',
      mode: 'demo' as const,
      minutes: 30,
      startedAt: '2026-09-17T09:40:00.000Z',
      submittedAt: '2026-09-17T10:00:00.000Z',
      reason: 'time-up' as const,
      tasks: [
        {
          taskId: 'scoreboard',
          language: 'python' as const,
          type: 'algorithmic' as const,
          correctness: { passed: 4, total: 5 },
          performance: { passed: 0, total: 3 },
        },
      ],
      assistantPrompts: 2,
    };
    const state = reduce([makeEvent(deps, 'online_test_submitted', payload)]);
    expect(state.onlineTests).toEqual([{ ...payload, localDate: '2026-09-17' }]);
    expect(state.xpByLocalDate).toEqual({});
  });

  it('keeps every path exam attempt as a fact, and grants no XP for sitting it', () => {
    const payload = {
      pathId: 'coding-rounds',
      seed: 7,
      right: 24,
      total: 28,
      startedAt: '2026-09-17T09:40:00.000Z',
      finishedAt: '2026-09-17T10:00:00.000Z',
      lessonIds: ['js.closures'],
    };
    const first = makeEvent(deps, 'path_exam_attempted', payload);
    const second = makeEvent(
      depsFor('device-1', '2026-09-18T10:00:00Z', 'e'),
      'path_exam_attempted',
      { ...payload, right: 12 },
    );
    const state = reduce([second, first]);
    const facts = {
      seed: payload.seed,
      right: payload.right,
      total: payload.total,
      startedAt: payload.startedAt,
      finishedAt: payload.finishedAt,
      lessonIds: payload.lessonIds,
    };
    expect(state.pathExams['coding-rounds']).toEqual([
      { ...facts, localDate: '2026-09-17' },
      { ...facts, right: 12, localDate: '2026-09-18' },
    ]);
    expect(state.xpByLocalDate).toEqual({});
    expect(reduce([first, first, second]).pathExams['coding-rounds']).toHaveLength(2);
  });

  it('applies placement_completed: assumed concepts and theta by module', () => {
    const event = makeEvent(deps, 'placement_completed', {
      startedAs: 'new',
      thetaByModule: { html: 900 },
      assumedConcepts: ['html.tags'],
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.assumedConcepts.has('html.tags')).toBe(true);
    expect(state.concepts['html.tags']?.assumed).toBe(true);
    expect(state.thetaByModule.html).toBe(900);
    expect(state.placementsCompleted).toBe(1);
    expect(initialProgressState().placementsCompleted).toBe(0);
  });

  it('applies last-writer-wins for goal tier, mode and settings', () => {
    const e1 = makeEvent(deps, 'goal_tier_set', { tier: 'light' });
    const e2 = makeEvent(depsFor('device-1', '2026-09-18T10:00:00Z', 'd'), 'goal_tier_set', {
      tier: 'deep',
    });
    let state = initialProgressState();
    state = applyEvent(state, e1);
    state = applyEvent(state, e2);
    expect(state.goalTier).toBe('deep');

    const m1 = makeEvent(deps, 'mode_set', { moduleId: 'js', mode: 'guided' });
    const m2 = makeEvent(depsFor('device-1', '2026-09-18T10:00:00Z', 'e'), 'mode_set', {
      moduleId: 'js',
      mode: 'challenge-first',
    });
    state = applyEvent(state, m1);
    state = applyEvent(state, m2);
    expect(state.modeByModule.js).toBe('challenge-first');

    const s1 = makeEvent(deps, 'setting_changed', { key: 'notifications', value: true });
    const s2 = makeEvent(depsFor('device-1', '2026-09-18T10:00:00Z', 'f'), 'setting_changed', {
      key: 'notifications',
      value: false,
    });
    state = applyEvent(state, s1);
    state = applyEvent(state, s2);
    expect(state.settings.notifications).toBe(false);
  });

  it('collects a reading', () => {
    const event = makeEvent(deps, 'reading_collected', { referenceKey: 'shen-tamkin-2026' });
    const state = applyEvent(initialProgressState(), event);
    expect(state.collectedReadings.has('shen-tamkin-2026')).toBe(true);
  });

  it('counts a passed ai-review towards aiReviewsPassed', () => {
    const event = makeEvent(deps, 'step_answered', {
      lessonId: 'js.security',
      stepId: 'review-1',
      stepType: 'ai-review',
      concept: 'js.security',
      difficulty: 3,
      tryNumber: 1,
      hintsUsed: 0,
      revealed: false,
      score: 1,
      correct: true,
      mode: 'guided',
      context: 'lesson',
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.aiReviewsPassed).toBe(1);
  });

  it('flags a concept as having reached Solid once mastery crosses 0.7, and keeps it', () => {
    // Two correct produce attempts should push P (and so mastery, uncapped once two
    // families and a produce pass are true) past the Solid threshold. Mastery is
    // 0.4 * memory + 0.6 * P, so P alone (capped at 1) tops out at raw = 0.6: a
    // freshly-reviewed card (R close to 1) is also needed to clear 0.7.
    let state = initialProgressState();
    const attemptDeps = (n: number) => depsFor('device-1', `2026-09-1${n}T10:00:00Z`, `g${n}`);
    for (let i = 1; i <= 6; i += 1) {
      const event = makeEvent(attemptDeps(i), 'step_answered', {
        lessonId: 'js.closures',
        stepId: `step-${i}`,
        stepType: i % 2 === 0 ? 'code-challenge' : 'predict-output',
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
      state = applyEvent(state, event);
    }
    const freshReview = makeEvent(
      depsFor('device-1', '2026-09-19T10:00:00Z', 'gg'),
      'review_graded',
      {
        cardKey: 'skill:js.closures#step-1',
        concept: 'js.closures',
        rating: 4,
        state: {
          due: '2026-09-26T10:00:00.000Z',
          stability: 30,
          difficulty: 3,
          reps: 1,
          lapses: 0,
          state: 'review',
          scheduledDays: 30,
          elapsedDays: 0,
          lastReview: '2026-09-19T10:00:00.000Z',
        },
      },
    );
    state = applyEvent(state, freshReview);
    expect(state.concepts['js.closures']?.wasEverSolidOrFluent).toBe(true);
  });

  it('records a placement_answered as a calibration answer', () => {
    const event = makeEvent(deps, 'placement_answered', {
      itemId: 'html-1',
      moduleId: 'html',
      rung: 1,
      correct: true,
      confidence: 'fairly',
    });
    const state = applyEvent(initialProgressState(), event);
    expect(state.calibrationAnswers).toEqual([
      { confidence: 'fairly', correct: true, moduleId: 'html' },
    ]);
  });

  it('leaves state unchanged for session and AI-hours facts (recorded, not yet derived from)', () => {
    const state0 = initialProgressState();
    const started = makeEvent(deps, 'session_started', {
      sessionId: 's1',
      kind: 'practice',
      minutes: 10,
      device: 'phone',
      seed: 1,
    });
    const finished = makeEvent(
      depsFor('device-1', '2026-09-17T10:10:00Z', 'h'),
      'session_finished',
      {
        sessionId: 's1',
        items: 14,
      },
    );
    const hours = makeEvent(depsFor('device-1', '2026-09-17T10:20:00Z', 'i'), 'ai_hours_reported', {
      isoWeek: '2026-W38',
      withAi: 2,
      withoutAi: 5,
    });
    let state = applyEvent(state0, started);
    state = applyEvent(state, finished);
    state = applyEvent(state, hours);
    expect(state).toEqual(state0);
  });

  it('ignores an unknown event', () => {
    const state = applyEvent(initialProgressState(), {
      type: 'unknown',
      originalType: 'mystery',
      reason: 'test',
      raw: {},
    });
    expect(state).toEqual(initialProgressState());
  });
});

describe('reduce', () => {
  function lessonCompletedEvents(): StoryEvent[] {
    const out: StoryEvent[] = [];
    out.push(
      makeEvent(depsFor('device-1', '2026-09-17T10:00:00Z', 'x'), 'lesson_completed', {
        lessonId: 'js.a',
      }),
    );
    out.push(
      makeEvent(depsFor('device-2', '2026-09-16T10:00:00Z', 'y'), 'lesson_completed', {
        lessonId: 'js.b',
      }),
    );
    out.push(
      makeEvent(depsFor('device-1', '2026-09-18T10:00:00Z', 'z'), 'lesson_completed', {
        lessonId: 'js.c',
      }),
    );
    return out;
  }

  it('is order-insensitive: shuffling the input gives the same state', () => {
    const events = lessonCompletedEvents();
    const inOrder = reduce(events);
    const rng = mulberry32(42);
    for (let trial = 0; trial < 20; trial += 1) {
      const shuffled = shuffle(events, rng);
      const state = reduce(shuffled);
      expect(state.completedLessons).toEqual(inOrder.completedLessons);
    }
  });

  it('de-duplicates events that share an id', () => {
    const events = lessonCompletedEvents();
    const withDuplicate = [...events, events[0] as StoryEvent];
    const state = reduce(withDuplicate);
    expect(state.completedLessons.size).toBe(3);
  });

  it('drops unknown events', () => {
    const events = lessonCompletedEvents();
    const withUnknown = [
      ...events,
      { type: 'unknown' as const, originalType: 'x', reason: 'r', raw: {} },
    ];
    const state = reduce(withUnknown);
    expect(state.completedLessons.size).toBe(3);
  });

  it('equals folding applyEvent over the same sorted, de-duplicated input', () => {
    const events = lessonCompletedEvents();
    const sorted = [...events].sort((a, b) =>
      a.at === b.at ? a.deviceId.localeCompare(b.deviceId) : a.at < b.at ? -1 : 1,
    );
    const folded = sorted.reduce(applyEvent, initialProgressState());
    const reduced = reduce(events);
    expect(reduced).toEqual(folded);
  });

  it('gives the same result for two devices holding the same event set in different orders', () => {
    const events = lessonCompletedEvents();
    const deviceAOrder = events;
    const deviceBOrder = [events[2], events[0], events[1]] as StoryEvent[];
    expect(reduce(deviceAOrder)).toEqual(reduce(deviceBOrder));
  });

  it('breaks a same-`at` tie by deviceId', () => {
    const sameInstant = '2026-09-17T10:00:00Z';
    const fromB = makeEvent(depsFor('device-b', sameInstant, 'p'), 'lesson_completed', {
      lessonId: 'js.b',
    });
    const fromA = makeEvent(depsFor('device-a', sameInstant, 'q'), 'lesson_completed', {
      lessonId: 'js.a',
    });
    // Apply in (at, deviceId) order by hand to know what "correct" looks like: both
    // just add to a set, so this mainly proves the comparator does not throw and is
    // stable regardless of input order.
    expect(reduce([fromB, fromA])).toEqual(reduce([fromA, fromB]));
  });

  it('breaks a same-`at`, same-device tie by seq', () => {
    const deps2 = depsFor('device-1', '2026-09-17T10:00:00Z', 'r');
    const first = makeEvent(deps2, 'lesson_completed', { lessonId: 'js.a' });
    const second = makeEvent(deps2, 'lesson_completed', { lessonId: 'js.b' });
    expect(first.seq).toBeLessThan(second.seq);
    expect(reduce([second, first])).toEqual(reduce([first, second]));
  });
});

describe('capstone decision records', () => {
  const first = makeEvent(depsFor('phone', '2026-09-17T10:00:00Z', 'p'), 'capstone_adr_written', {
    partId: 'servers',
    title: 'Keep sessions in memory',
    context: 'One server process.',
    decision: 'A map in memory.',
  });
  const edit = makeEvent(depsFor('laptop', '2026-09-19T08:00:00Z', 'l'), 'capstone_adr_written', {
    partId: 'servers',
    title: 'Keep sessions in the database',
    decision: 'Sessions live in a table.',
    alternatives: 'A map in memory.',
  });
  const other = makeEvent(depsFor('phone', '2026-09-18T10:00:00Z', 'q'), 'capstone_adr_written', {
    partId: 'firstcode',
    title: 'Plain HTML first',
    decision: 'No framework.',
  });

  it('keeps the latest record per part, whatever order the logs merge in', () => {
    for (const order of [
      [first, edit, other],
      [edit, other, first],
      [other, edit, first, edit],
    ]) {
      const state = reduce(order);
      expect(state.capstoneAdrs.servers).toEqual({
        partId: 'servers',
        title: 'Keep sessions in the database',
        decision: 'Sessions live in a table.',
        alternatives: 'A map in memory.',
        firstWrittenOn: '2026-09-17',
        updatedOn: '2026-09-19',
        revisions: 2,
      });
      expect(state.capstoneAdrs.firstcode?.revisions).toBe(1);
    }
  });

  it('does not need the capstone to be marked built, and does not mark it', () => {
    const state = reduce([first]);
    expect(state.completedCapstones.has('servers')).toBe(false);
    expect(state.capstoneAdrs.servers?.title).toBe('Keep sessions in memory');
  });
});
