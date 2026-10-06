import type { CatalogFile, CatalogLesson } from '@/core/practice';
import { makeEvent, type EventType, type PayloadOf, type StoryEvent } from '@/core/progress';

/*
 * A small course for the progress tests: two parts, a woven chapter, five lessons. The
 * module ids are real ones, so the interests in src/core/profile/interests.ts map onto them.
 */

const lesson = (
  moduleId: string,
  slug: string,
  concepts: string[],
  minutes = 10,
): CatalogLesson => ({
  title: `Lesson ${slug}`,
  moduleId,
  moduleSlug: moduleId === 'js' ? 'javascript' : moduleId,
  slug,
  level: 'essential',
  minutes,
  concepts,
  file: `lessons/${moduleId}.${slug}.json`,
});

export const course: CatalogFile = {
  schema: 1,
  contentRev: 'rev',
  modules: [
    { id: 'js', number: 3, slug: 'javascript', title: 'JavaScript' },
    { id: 'cs', number: 4, slug: 'cs', title: 'Computer science' },
    { id: 'db', number: 10, slug: 'db', title: 'Databases' },
  ],
  concepts: [
    { id: 'js.scope', moduleId: 'js', title: 'Scope', summary: 'Where a name is visible.' },
    { id: 'js.closures', moduleId: 'js', title: 'Closures', summary: 'Functions that remember.' },
    { id: 'cs.big-o', moduleId: 'cs', title: 'Big O', summary: 'How cost grows.' },
    { id: 'db.joins', moduleId: 'db', title: 'Joins', summary: 'Rows from two tables.' },
    { id: 'db.index', moduleId: 'db', title: 'Indexes', summary: 'Finding rows fast.' },
  ],
  lessons: {
    'js.scope': lesson('js', 'scope', ['js.scope']),
    'js.closures': lesson('js', 'closures', ['js.closures'], 15),
    'cs.big-o': lesson('cs', 'big-o', ['cs.big-o']),
    'db.joins': lesson('db', 'joins', ['db.joins'], 20),
    'db.index': lesson('db', 'index', ['db.index']),
  },
  skillItems: [],
  recallCards: [],
  parts: [
    {
      id: 'code',
      title: 'Code',
      summary: 'Programs.',
      modules: ['js'],
      capstone: { title: 'A small tool', brief: 'Build it.' },
      lessons: ['js.scope', 'cs.big-o', 'js.closures'],
      concepts: ['js.scope', 'cs.big-o', 'js.closures'],
    },
    {
      id: 'data',
      title: 'Data',
      summary: 'Storage.',
      modules: ['db'],
      capstone: { title: 'A schema', brief: 'Design it.' },
      lessons: ['db.joins', 'db.index'],
      concepts: ['db.joins', 'db.index'],
    },
  ],
};

let seq = 0;

/** An event at an instant, dated in UTC, which stands in for the learner's zone. */
export function event<T extends EventType>(at: string, type: T, payload: PayloadOf<T>): StoryEvent {
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

export const answered = (
  at: string,
  concept: string,
  overrides: Partial<PayloadOf<'step_answered'>> = {},
) =>
  event(at, 'step_answered', {
    lessonId: concept,
    stepId: 'step',
    stepType: 'predict-output',
    concept,
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

export const sat = (
  at: string,
  testKey: string,
  passed: number,
  overrides: Partial<PayloadOf<'online_test_submitted'>> = {},
) =>
  event(at, 'online_test_submitted', {
    attemptId: `a-${at}`,
    testKey,
    title: `Test ${testKey}`,
    mode: 'mock',
    minutes: 60,
    startedAt: new Date(new Date(at).getTime() - 30 * 60_000).toISOString(),
    submittedAt: at,
    reason: 'candidate',
    tasks: [
      {
        taskId: 't1',
        language: 'ts',
        type: 'coding',
        correctness: { passed, total: 4 },
        performance: { passed: 0, total: 0 },
      },
    ],
    assistantPrompts: 0,
    ...overrides,
  });
