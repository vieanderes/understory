import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  daysBetween,
  GOAL_COPY,
  itemDone,
  milestoneDone,
  PLAN_GOALS,
  planPace,
  planProgress,
  type PlanAnswers,
  type PlanCatalog,
  type PlanFacts,
} from '@/core/plan';

const lessons = (prefix: string, n: number, minutes = 10) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}.${i + 1}`,
    title: `${prefix} ${i + 1}`,
    minutes,
  }));

const CATALOG: PlanCatalog = {
  paths: [
    {
      id: 'start-coding',
      name: 'Start coding',
      stages: [{ title: 'A', lessons: lessons('basics', 4) }],
    },
    {
      id: 'javascript-typescript',
      name: 'JS',
      stages: [
        { title: 'A', lessons: lessons('js', 3) },
        { title: 'B', lessons: lessons('ts', 2) },
      ],
    },
    { id: 'python', name: 'Python', stages: [{ title: 'A', lessons: lessons('py', 3) }] },
    {
      id: 'coding-rounds',
      name: 'Algorithms',
      stages: [
        { title: 'A', lessons: [...lessons('algo', 3), { id: 'js.1', title: 'dup', minutes: 10 }] },
      ],
    },
    { id: 'ai-engineering', name: 'AI', stages: [{ title: 'A', lessons: lessons('ai', 4) }] },
    {
      id: 'ai-coding-tests',
      name: 'AI tests',
      stages: [
        { title: 'Method', lessons: lessons('method', 2) },
        { title: 'Tasks', lessons: lessons('tasks', 2) },
      ],
    },
    {
      id: 'interview-loop',
      name: 'Interviews',
      stages: [{ title: 'A', lessons: lessons('loop', 2) }],
    },
  ],
  parts: [
    { id: 'interfaces', title: 'Interfaces', lessons: lessons('ui', 2) },
    { id: 'servers', title: 'Servers', lessons: lessons('srv', 2) },
    { id: 'production', title: 'Production', lessons: lessons('prod', 2) },
    { id: 'senior', title: 'Senior', lessons: lessons('sen', 2) },
  ],
  tests: [
    { key: 'demo', title: 'Demo test', minutes: 30 },
    { key: 'screen-a', title: 'Screen A', minutes: 90 },
    { key: 'mock-a', title: 'Mock A', minutes: 90 },
  ],
};

const base: PlanAnswers = {
  goal: 'from-zero',
  level: 'new',
  language: 'js',
  minutesPerWeek: 140,
  since: '2026-10-01',
};
const none: PlanFacts = { completedLessons: new Set(), bestTestScores: {}, passedExams: new Set() };

describe('building a plan', () => {
  it('orders a beginner from first programs to a language to patterns, without repeats', () => {
    const plan = buildPlan(base, CATALOG);
    expect(plan.phases.map((p) => p.id)).toEqual(['foundations', 'language', 'patterns']);
    expect(plan.phases[2]?.items.map((i) => (i.kind === 'lesson' ? i.id : ''))).not.toContain(
      'js.1',
    );
    expect(plan.phases[0]?.milestone).toEqual({
      kind: 'path-exam',
      pathId: 'start-coding',
      title: 'Start coding exam',
    });
    expect(plan.trimmed).toBe(false);
    expect(plan.minutes).toBe(4 * 10 + 5 * 10 + 3 * 10);
  });

  it('follows the chosen language', () => {
    const python = buildPlan({ ...base, language: 'python' }, CATALOG);
    expect(python.phases[1]?.title).toBe('Python properly');
    const second = buildPlan({ ...base, goal: 'second-language', language: 'python' }, CATALOG);
    expect(second.phases[0]?.items[0]).toMatchObject({ kind: 'lesson', id: 'js.1' });
  });

  it('builds every goal', () => {
    for (const goal of PLAN_GOALS) {
      for (const level of ['new', 'some', 'pro'] as const) {
        const plan = buildPlan({ ...base, goal, level }, CATALOG);
        expect(plan.phases.length, `${goal} ${level}`).toBeGreaterThan(0);
        expect(plan.title).toBe(GOAL_COPY[goal].title);
      }
    }
  });

  it('skips what a professional already knows', () => {
    expect(
      buildPlan({ ...base, goal: 'builder', level: 'pro' }, CATALOG).phases.map((p) => p.id),
    ).toEqual(['interfaces', 'servers', 'production']);
    expect(buildPlan({ ...base, goal: 'builder', level: 'new' }, CATALOG).phases[0]?.id).toBe(
      'foundations',
    );
    expect(
      buildPlan({ ...base, goal: 'ai-engineer', level: 'pro' }, CATALOG).phases.map((p) => p.id),
    ).toEqual(['ai']);
  });

  it('trims interview prep to the deadline by priority, keeping the routine and timed practice', () => {
    const tight = buildPlan(
      { ...base, goal: 'interviews', level: 'some', deadline: '2026-10-04', minutesPerWeek: 560 },
      CATALOG,
    );
    const kept = tight.phases.filter((p) => !p.optional).map((p) => p.id);
    expect(kept).toEqual(['routine', 'timed']);
    expect(tight.trimmed).toBe(true);
    const roomy = buildPlan(
      { ...base, goal: 'interviews', level: 'some', deadline: '2026-12-01', minutesPerWeek: 700 },
      CATALOG,
    );
    expect(roomy.phases.every((p) => !p.optional)).toBe(true);
    expect(roomy.phases.at(-1)?.id).toBe('language');
  });

  it('turns stay-sharp into habits, not lessons', () => {
    const plan = buildPlan({ ...base, goal: 'stay-sharp', level: 'pro' }, CATALOG);
    expect(plan.phases[0]?.items.map((i) => i.kind)).toEqual(['habit', 'habit']);
    expect(plan.minutes).toBe(0);
  });

  it('leaves out a phase whose lessons are missing from the catalogue', () => {
    const plan = buildPlan({ ...base, goal: 'senior' }, { ...CATALOG, parts: [] });
    expect(plan.phases.map((p) => p.id)).toEqual(['loop']);
  });
});

describe('progress and pace', () => {
  const plan = buildPlan(base, CATALOG);

  it('counts done lessons per phase and names the next step', () => {
    const facts: PlanFacts = { ...none, completedLessons: new Set(['basics.1', 'basics.2']) };
    const progress = planProgress(plan, facts);
    expect(progress.phases[0]).toEqual({ id: 'foundations', done: 2, total: 4, complete: false });
    expect(progress.next).toEqual({
      phaseId: 'foundations',
      item: expect.objectContaining({ id: 'basics.3' }),
    });
    expect(progress.doneMinutes).toBe(20);
    expect(progress.share).toBeCloseTo(20 / plan.minutes);
  });

  it('marks tests and exams done by score', () => {
    expect(
      itemDone(
        { kind: 'test', key: 'demo', title: 'Demo', minutes: 30, target: 80 },
        { ...none, bestTestScores: { demo: 85 } },
      ),
    ).toBe(true);
    expect(
      itemDone(
        { kind: 'test', key: 'demo', title: 'Demo', minutes: 30, target: 80 },
        { ...none, bestTestScores: { demo: 60 } },
      ),
    ).toBe(false);
    expect(
      itemDone({ kind: 'habit', href: '/', title: 'x', minutes: 10, every: 'day' }, none),
    ).toBe(false);
    expect(
      milestoneDone(
        { kind: 'path-exam', pathId: 'python', title: 'x' },
        { ...none, passedExams: new Set(['python']) },
      ),
    ).toBe(true);
    expect(
      milestoneDone(
        { kind: 'test', key: 'mock-a', title: 'x', target: 70 },
        { ...none, bestTestScores: { 'mock-a': 70 } },
      ),
    ).toBe(true);
    expect(milestoneDone({ kind: 'checkpoint', partId: 'senior', title: 'x' }, none)).toBe(false);
  });

  it('says nothing is next when every counted item is done', () => {
    const all = new Set(
      plan.phases.flatMap((p) => p.items.flatMap((i) => (i.kind === 'lesson' ? [i.id] : []))),
    );
    expect(planProgress(plan, { ...none, completedLessons: all }).next).toBeUndefined();
  });

  it('compares the work done with the calendar', () => {
    const withDate: PlanAnswers = { ...base, deadline: '2026-10-11' };
    const dated = buildPlan(withDate, CATALOG);
    const start = planProgress(dated, none);
    expect(planPace(dated, withDate, start, '2026-10-01')).toMatchObject({
      status: 'on-track',
      daysLeft: 10,
    });
    expect(planPace(dated, withDate, start, '2026-10-08').status).toBe('behind');
    const far = planProgress(dated, {
      ...none,
      completedLessons: new Set(['basics.1', 'basics.2', 'basics.3', 'basics.4', 'js.1', 'js.2']),
    });
    expect(planPace(dated, withDate, far, '2026-10-02').status).toBe('ahead');
    expect(planPace(dated, withDate, start, '2026-10-20')).toMatchObject({
      status: 'past',
      minutesPerDay: 0,
    });
    expect(planPace(plan, base, start, '2026-10-05')).toEqual({
      status: 'no-deadline',
      minutesPerDay: 20,
    });
    expect(daysBetween('2026-10-01', '2026-10-11')).toBe(10);
  });
});

describe('the next step', () => {
  it('turns to "if time allows" only after the counted phases are done', () => {
    const answers: PlanAnswers = {
      ...base,
      goal: 'interviews',
      level: 'some',
      deadline: '2026-10-04',
      minutesPerWeek: 560,
    };
    const plan = buildPlan(answers, CATALOG);
    const counted = plan.phases
      .filter((p) => !p.optional)
      .flatMap((p) => p.items.flatMap((i) => (i.kind === 'lesson' ? [i.id] : [])));
    const facts: PlanFacts = {
      ...none,
      completedLessons: new Set(counted),
      bestTestScores: { demo: 90, 'screen-a': 90, 'mock-a': 90 },
    };
    const next = planProgress(plan, facts).next;
    expect(plan.phases.find((p) => p.id === next?.phaseId)?.optional).toBe(true);
  });
});
