import { describe, expect, it } from 'vitest';
import {
  capstoneRecords,
  chaptersNotStarted,
  codingTests,
  examRecords,
  masteryByPart,
  progressReport,
  progressScopes,
  recallHealth,
  testOutRecords,
  weeklyActivity,
  workOn,
  type ConceptView,
  type ProgressScope,
} from '@/core/insight';
import type { MasteryState } from '@/core/mastery';
import { reduce } from '@/core/progress';
import { answered, course, event, sat } from './fixture';

const NOW = new Date('2026-10-06T12:00:00Z');
const TODAY = '2026-10-06';

const scopes = progressScopes({
  catalog: course,
  path: { id: 'rounds', name: 'Rounds', lessonIds: ['js.scope', 'js.closures'], timedTests: true },
  paths: [
    { id: 'rounds', name: 'Rounds', lessonIds: ['js.scope', 'js.closures'], timedTests: true },
  ],
  interests: ['backend'],
});
const scope = (id: string): ProgressScope => scopes.find((s) => s.id === id)!;
const all = scope('all');

function view(id: string, state: MasteryState, extra: Partial<ConceptView> = {}): ConceptView {
  const concept = course.concepts.find((c) => c.id === id)!;
  return {
    id,
    moduleId: concept.moduleId,
    title: concept.title,
    summary: concept.summary,
    state,
    mastery: 0.5,
    recall: null,
    nextDue: null,
    dueNow: false,
    ...extra,
  };
}

const unseen = course.concepts.map((c) => view(c.id, 'unseen'));
const withViews = (...views: ConceptView[]) =>
  unseen.map((u) => views.find((v) => v.id === u.id) ?? u);

const TESTS = [
  { id: 'practice-1', title: 'Practice test 1' },
  { id: 'practice-2', title: 'Practice test 2' },
];

describe('weeklyActivity', () => {
  it('lays out the last eight weeks, oldest first, ending with this one', () => {
    const { weeks, goal } = weeklyActivity({
      catalog: course,
      state: reduce([]),
      scope: all,
      today: TODAY,
    });
    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)).toMatchObject({ weekKey: '2026-W41', start: '2026-10-05', current: true });
    expect(weeks[0]).toMatchObject({ weekKey: '2026-W34', start: '2026-08-17', current: false });
    expect(weeks.every((w) => w.xp === 0 && w.minutes === 0 && w.lessons === 0)).toBe(true);
    expect(goal).toBe(300);
  });

  it('counts lessons, their minutes, timed tests and exams in the week they were done', () => {
    const state = reduce([
      event('2026-10-05T09:00:00Z', 'goal_tier_set', { tier: 'light' }),
      event('2026-09-29T10:00:00Z', 'lesson_completed', { lessonId: 'js.scope' }),
      event('2026-10-05T10:00:00Z', 'lesson_completed', { lessonId: 'js.closures' }),
      event('2026-10-06T10:00:00Z', 'lesson_completed', { lessonId: 'db.joins' }),
      sat('2026-10-06T11:00:00Z', 'practice-1', 4),
      event('2026-10-06T11:30:00Z', 'path_exam_attempted', {
        pathId: 'rounds',
        seed: 1,
        right: 8,
        total: 10,
        startedAt: '2026-10-06T11:10:00Z',
        finishedAt: '2026-10-06T11:30:00Z',
        lessonIds: ['js.scope'],
      }),
      answered('2026-10-06T10:05:00Z', 'js.scope'),
    ]);
    const everything = weeklyActivity({ catalog: course, state, scope: all, today: TODAY });
    const thisWeek = everything.weeks.at(-1)!;
    // 15 + 20 lesson minutes, 30 test minutes, 20 exam minutes.
    expect(thisWeek).toMatchObject({ lessons: 2, minutes: 85 });
    expect(thisWeek.xp).toBeGreaterThan(0);
    expect(everything.weeks.at(-2)).toMatchObject({ lessons: 1, minutes: 10 });
    expect(everything.goal).toBe(150);

    const data = weeklyActivity({
      catalog: course,
      state,
      scope: scope('part-data'),
      today: TODAY,
    });
    expect(data.weeks.at(-1)).toMatchObject({ lessons: 1, minutes: 20 });
  });

  it('marks the weeks whose goal was met and counts them', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      answered(`2026-09-2${(i % 3) + 1}T10:${String(i).padStart(2, '0')}:00Z`, 'js.scope', {
        stepType: 'code-challenge',
        stepId: `s${i}`,
      }),
    );
    const state = reduce([
      event('2026-09-20T09:00:00Z', 'goal_tier_set', { tier: 'light' }),
      ...many,
    ]);
    const { weeks, met } = weeklyActivity({ catalog: course, state, scope: all, today: TODAY });
    const week = weeks.find((w) => w.weekKey === '2026-W39')!;
    expect(week.met).toBe(true);
    expect(met).toBe(1);
  });

  it('caps a sitting at its time limit', () => {
    const state = reduce([
      sat('2026-10-06T11:00:00Z', 'practice-1', 4, {
        minutes: 10,
        startedAt: '2026-10-06T08:00:00Z',
      }),
    ]);
    const { weeks } = weeklyActivity({ catalog: course, state, scope: all, today: TODAY });
    expect(weeks.at(-1)!.minutes).toBe(10);
    const none = weeklyActivity({
      catalog: course,
      state,
      scope: scope('part-data'),
      today: TODAY,
    });
    expect(none.weeks.at(-1)!.minutes).toBe(0);
  });
});

describe('recallHealth', () => {
  it('sorts each concept with cards into one bucket: due, fading or holding', () => {
    const views = withViews(
      view('js.scope', 'practised', { recall: 0.95, dueNow: true }),
      view('js.closures', 'gap', { recall: 0.9 }),
      view('cs.big-o', 'practised', { recall: 0.6 }),
      view('db.joins', 'solid', { recall: 0.97 }),
    );
    expect(recallHealth(views, all)).toEqual({ due: 1, fading: 2, holding: 1 });
    expect(recallHealth(views, scope('part-data'))).toEqual({ due: 0, fading: 0, holding: 1 });
  });
});

describe('masteryByPart', () => {
  it('groups the concepts in scope by part and chapter, the woven ones last', () => {
    const views = withViews(
      view('js.scope', 'solid'),
      view('js.closures', 'gap'),
      view('cs.big-o', 'practised'),
      view('db.joins', 'fluent'),
    );
    const parts = masteryByPart(course, all, views);
    expect(parts.map((p) => [p.id, p.number])).toEqual([
      ['code', 1],
      ['data', 2],
      ['woven', null],
    ]);
    expect(parts[0]).toMatchObject({ total: 2, started: 2, solid: 1, gaps: 1 });
    expect(parts[0]!.chapters).toEqual([
      expect.objectContaining({ id: 'js', title: 'JavaScript', number: 3, total: 2, solid: 1 }),
    ]);
    expect(parts[1]).toMatchObject({ total: 2, started: 1, solid: 1, gaps: 0 });
    expect(parts[2]).toMatchObject({ title: 'Woven through the course', total: 1, started: 1 });

    const data = masteryByPart(course, scope('part-data'), views);
    expect(data.map((p) => p.id)).toEqual(['data']);
  });
});

describe('codingTests', () => {
  it('lists every sitting newest first, the best and the trend per test, and those never sat', () => {
    const state = reduce([
      sat('2026-09-20T10:00:00Z', 'practice-1', 1),
      sat('2026-09-27T10:00:00Z', 'practice-1', 3),
      sat('2026-10-04T10:00:00Z', 'practice-1', 2, { guided: true }),
      sat('2026-10-05T10:00:00Z', 'custom', 4, { title: 'My test' }),
    ]);
    const tests = codingTests(state, TESTS);
    expect(tests.sittings.map((s) => [s.testKey, s.score, s.on])).toEqual([
      ['custom', 100, '2026-10-05'],
      ['practice-1', 50, '2026-10-04'],
      ['practice-1', 75, '2026-09-27'],
      ['practice-1', 25, '2026-09-20'],
    ]);
    expect(tests.sittings[1]!.guided).toBe(true);
    const first = tests.byTest.find((t) => t.testKey === 'practice-1')!;
    expect(first).toMatchObject({
      title: 'Practice test 1',
      best: 75,
      last: 50,
      sittings: 3,
      trend: [25, 75, 50],
      href: '/practise/online-test/practice-1',
    });
    expect(tests.byTest.find((t) => t.testKey === 'custom')!.title).toBe('My test');
    expect(tests.neverSat).toEqual([
      { id: 'practice-2', title: 'Practice test 2', href: '/practise/online-test/practice-2' },
    ]);
  });
});

describe('examRecords', () => {
  it('reports the sittings, best and pass of each exam in scope', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'path_exam_attempted', {
        pathId: 'rounds',
        seed: 1,
        right: 6,
        total: 10,
        startedAt: '2026-10-01T09:30:00Z',
        finishedAt: '2026-10-01T10:00:00Z',
        lessonIds: [],
      }),
      event('2026-10-03T10:00:00Z', 'path_exam_attempted', {
        pathId: 'rounds',
        seed: 2,
        right: 9,
        total: 10,
        startedAt: '2026-10-03T09:30:00Z',
        finishedAt: '2026-10-03T10:00:00Z',
        lessonIds: [],
      }),
    ]);
    const names = { rounds: 'Rounds' };
    expect(examRecords(state, scope('path'), names)).toEqual([
      {
        pathId: 'rounds',
        name: 'Rounds',
        sittings: 2,
        best: 90,
        passed: true,
        lastOn: '2026-10-03',
        href: '/practise/exam/rounds',
      },
    ]);
    expect(examRecords(state, scope('part-data'), names)).toEqual([]);
    expect(examRecords(reduce([]), scope('path'), names)).toEqual([]);
  });
});

describe('testOutRecords', () => {
  it('reports test-outs of the parts and chapters in scope', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'test_out_attempted', {
        moduleId: 'data',
        score: 0.6,
        passed: false,
      }),
      event('2026-10-02T10:00:00Z', 'test_out_attempted', {
        moduleId: 'data',
        score: 0.85,
        passed: true,
      }),
      event('2026-10-02T11:00:00Z', 'test_out_attempted', {
        moduleId: 'js',
        score: 0.5,
        passed: false,
      }),
      event('2026-10-02T12:00:00Z', 'test_out_attempted', {
        moduleId: 'gone',
        score: 0.5,
        passed: false,
      }),
    ]);
    expect(testOutRecords(state, course, all)).toEqual([
      { id: 'data', title: 'Data', sittings: 2, best: 85, passed: true },
      { id: 'js', title: 'JavaScript', sittings: 1, best: 50, passed: false },
    ]);
    expect(testOutRecords(state, course, scope('part-data')).map((r) => r.id)).toEqual(['data']);
  });
});

describe('capstoneRecords', () => {
  it('says per part in scope whether its capstone is built, written up and ready', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'db.joins' }),
      event('2026-10-01T10:01:00Z', 'lesson_completed', { lessonId: 'db.index' }),
      event('2026-10-02T10:00:00Z', 'capstone_completed', { moduleId: 'code' }),
      event('2026-10-02T10:01:00Z', 'capstone_adr_written', {
        partId: 'code',
        title: 'Use a queue',
        decision: 'A queue.',
      }),
    ]);
    expect(capstoneRecords(course, state, all)).toEqual([
      {
        partId: 'code',
        title: 'A small tool',
        built: true,
        written: true,
        ready: false,
        href: '/learn#part-code',
      },
      {
        partId: 'data',
        title: 'A schema',
        built: false,
        written: false,
        ready: true,
        href: '/learn#part-data',
      },
    ]);
  });
});

describe('chaptersNotStarted', () => {
  it('lists chapters in scope with no lesson done, linked to their first lesson', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'js.scope' }),
    ]);
    expect(chaptersNotStarted(course, state, all)).toEqual([
      { id: 'cs', title: 'Computer science', lessons: 1, minutes: 10, href: '/learn/cs/big-o' },
      { id: 'db', title: 'Databases', lessons: 2, minutes: 30, href: '/learn/db/joins' },
    ]);
    expect(chaptersNotStarted(course, state, scope('path'))).toEqual([]);
  });
});

describe('workOn', () => {
  const empty = reduce([]);

  it('starts a new learner on the first lesson in scope', () => {
    const items = workOn({
      catalog: course,
      state: empty,
      scope: scope('part-data'),
      views: unseen,
      tests: [],
    });
    expect(items[0]).toMatchObject({
      kind: 'lesson',
      title: 'Lesson joins',
      href: '/learn/db/joins',
      first: true,
    });
    expect(items.map((i) => i.kind)).toEqual(['lesson']);
  });

  it('puts gaps first, then reviews due, then the next lesson, at most five things', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'js.scope' }),
      sat('2026-10-02T10:00:00Z', 'practice-1', 1),
    ]);
    const views = withViews(
      view('js.closures', 'gap', { recall: 0.4 }),
      view('db.joins', 'gap', { recall: 0.5 }),
      view('js.scope', 'practised', { recall: 0.95, dueNow: true, mastery: 0.3 }),
      view('cs.big-o', 'introduced', { mastery: 0.2 }),
    );
    const items = workOn({ catalog: course, state, scope: all, views, tests: TESTS });
    // js.scope is due, so it is not offered again as weak.
    expect(items.map((i) => i.kind)).toEqual(['gaps', 'due', 'lesson', 'weak', 'retest']);
    expect(items[0]).toMatchObject({
      count: 2,
      names: ['Closures', 'Joins'],
      href: '/practise/session/10?topics=typescript',
    });
    expect(items[1]).toMatchObject({ count: 1, href: '/practise/session/10?topics=typescript' });
    expect(items[2]).toMatchObject({ title: 'Lesson big-o', first: false });
    expect(items[3]).toMatchObject({ title: 'Big O', mastery: 0.2, href: '/learn/cs/big-o' });
  });

  it('narrows practice to the topic of the scope, else to none', () => {
    const views = withViews(view('db.joins', 'gap'));
    const twice = {
      ...course,
      lessons: {
        ...course.lessons,
        'db.joins': { ...course.lessons['db.joins']!, concepts: ['db.joins', 'db.index'] },
      },
    };
    const sameLesson = workOn({
      catalog: twice,
      state: reduce([
        event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'db.joins' }),
        event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'db.index' }),
      ]),
      scope: scope('part-data'),
      views: withViews(view('db.joins', 'practised'), view('db.index', 'practised')),
      tests: [],
    });
    expect(sameLesson.filter((i) => i.kind === 'weak')).toHaveLength(1);
    const topic = scopes.find((s) => s.id === 'topic-backend')!;
    expect(workOn({ catalog: course, state: empty, scope: topic, views, tests: [] })[0]!.href).toBe(
      '/practise/session/10?topics=backend',
    );
    const noTopic = { ...course, concepts: [{ ...course.concepts[3]!, moduleId: 'zz' }] };
    expect(
      workOn({
        catalog: noTopic,
        state: empty,
        scope: all,
        views: [{ ...views[3]!, moduleId: 'zz' }],
        tests: [],
      })[0]!.href,
    ).toBe('/practise/session/10');
  });

  it('offers the exam once a path is done, a checkpoint, a weak test and a test not sat', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'js.scope' }),
      event('2026-10-01T10:01:00Z', 'lesson_completed', { lessonId: 'js.closures' }),
      event('2026-10-01T10:02:00Z', 'lesson_completed', { lessonId: 'cs.big-o' }),
      sat('2026-10-02T10:00:00Z', 'practice-1', 1),
    ]);
    const path = workOn({
      catalog: course,
      state,
      scope: scope('path'),
      views: unseen,
      tests: TESTS,
    });
    expect(path.map((i) => i.kind)).toEqual(['exam', 'checkpoint', 'retest', 'test']);
    expect(path[0]).toMatchObject({ title: 'Rounds', href: '/practise/exam/rounds' });
    expect(path[1]).toMatchObject({ title: 'Code', href: '/practise/checkpoint/code' });
    expect(path[2]).toMatchObject({ title: 'Practice test 1', best: 25 });
    expect(path[3]).toMatchObject({
      title: 'Practice test 2',
      href: '/practise/online-test/practice-2',
    });
  });

  it('sends a weak concept no lesson teaches to practice, and offers no exam once passed', () => {
    const untaught = {
      ...course,
      concepts: [
        ...course.concepts,
        { id: 'js.extra', moduleId: 'js', title: 'Extra', summary: '' },
      ],
    };
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'js.scope' }),
      event('2026-10-01T10:01:00Z', 'lesson_completed', { lessonId: 'js.closures' }),
      event('2026-10-02T10:00:00Z', 'path_exam_attempted', {
        pathId: 'rounds',
        seed: 1,
        right: 9,
        total: 10,
        startedAt: '2026-10-02T09:40:00Z',
        finishedAt: '2026-10-02T10:00:00Z',
        lessonIds: [],
      }),
    ]);
    const extra = { ...view('js.scope', 'practised'), id: 'js.extra', title: 'Extra' };
    const items = workOn({
      catalog: untaught,
      state,
      scope: { ...scope('path'), conceptIds: ['js.extra'] },
      views: [extra],
      tests: [],
    });
    expect(items.map((i) => [i.kind, i.href])).toEqual([
      ['weak', '/practise/session/10?topics=typescript'],
    ]);
  });

  it('suggests a chapter not started besides the next lesson', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'js.scope' }),
    ]);
    const items = workOn({ catalog: course, state, scope: all, views: unseen, tests: [] });
    expect(items.map((i) => [i.kind, i.title])).toEqual([
      ['lesson', 'Lesson big-o'],
      ['chapter', 'Databases'],
    ]);
  });
});

describe('progressReport', () => {
  it('says a new learner has not started, with the first lesson to do', () => {
    const report = progressReport({
      catalog: course,
      state: reduce([]),
      now: NOW,
      today: TODAY,
      scope: all,
      tests: TESTS,
      pathNames: {},
    });
    expect(report.started).toBe(false);
    expect(report.lessons).toEqual({ done: 0, total: 5, minutesLeft: 65 });
    expect(report.next?.href).toBe('/learn/javascript/scope');
  });

  it('brings every figure together for the scope', () => {
    const state = reduce([
      event('2026-10-01T10:00:00Z', 'lesson_completed', { lessonId: 'js.scope' }),
      answered('2026-10-01T10:00:00Z', 'js.scope'),
      sat('2026-10-02T10:00:00Z', 'practice-1', 3),
    ]);
    const report = progressReport({
      catalog: course,
      state,
      now: NOW,
      today: TODAY,
      scope: scope('path'),
      tests: TESTS,
      pathNames: { rounds: 'Rounds' },
    });
    expect(report.started).toBe(true);
    expect(report.lessons).toEqual({ done: 1, total: 2, minutesLeft: 15 });
    expect(report.concepts.total).toBe(2);
    expect(report.concepts.started).toBe(1);
    expect(report.weeks).toHaveLength(8);
    expect(report.mastery.map((p) => p.id)).toEqual(['code']);
    expect(report.tests.sittings).toHaveLength(1);
    expect(report.exams).toEqual([]);
    expect(report.capstones.map((c) => c.partId)).toEqual(['code']);
    expect(report.next?.kind).toBe('lesson');
    expect(report.workOn[0]).toBe(report.next);
  });

  it('leaves timed tests out of a scope without them', () => {
    const state = reduce([sat('2026-10-02T10:00:00Z', 'practice-1', 3)]);
    const report = progressReport({
      catalog: course,
      state,
      now: NOW,
      today: TODAY,
      scope: scope('part-data'),
      tests: TESTS,
      pathNames: {},
    });
    expect(report.started).toBe(true);
    expect(report.tests.sittings).toEqual([]);
    expect(report.tests.neverSat).toEqual([]);
  });
});
