import { describe, expect, it } from 'vitest';
import { placedOut, placementKnows, recommendPath, type RecommendInput } from '@/core/placement';

const lessons = [
  { id: 'web.one', moduleId: 'web', concepts: ['web.a'] },
  { id: 'web.two', moduleId: 'web', concepts: ['web.b'] },
  { id: 'web.three', moduleId: 'web', concepts: ['web.c', 'web.d'] },
  { id: 'api.one', moduleId: 'api', concepts: ['api.a'] },
  { id: 'api.two', moduleId: 'api', concepts: ['api.b'] },
  { id: 'db.one', moduleId: 'db', concepts: ['db.a'] },
];

const base: RecommendInput = {
  focus: { id: 'web', title: 'The web', modules: ['web'] },
  level: 1,
  rules: [
    { area: 'web', below: 2, path: 'web-basics' },
    { area: 'web', below: 3, path: 'web-deep' },
  ],
  paths: [
    {
      id: 'web-basics',
      name: 'Web basics',
      stages: [
        { title: 'Start', why: 'First steps.', lessonIds: ['web.one', 'web.two'] },
        { title: 'Then', why: 'Next.', lessonIds: ['web.three'] },
      ],
    },
    {
      id: 'web-deep',
      name: 'Web in depth',
      stages: [{ title: 'Deep', why: 'Harder.', lessonIds: ['web.three'] }],
    },
  ],
  lessons,
  moduleTitles: { web: 'Web', api: 'APIs', db: 'Data' },
  isDone: () => false,
  isKnown: () => false,
};

describe('placedOut', () => {
  it('is true when placement showed every concept of the lesson', () => {
    expect(placedOut(['a', 'b'], (c) => c !== 'x')).toBe(true);
    expect(placedOut(['a', 'x'], (c) => c !== 'x')).toBe(false);
  });

  it('never places out a lesson that names no concept', () => {
    expect(placedOut([], () => true)).toBe(false);
  });
});

describe('placementKnows', () => {
  const knows = placementKnows({
    assumedConcepts: new Set(['a', 'b', 'c']),
    concepts: { b: { p: 0.2, attemptCount: 2 }, c: { p: 0.8, attemptCount: 3 } },
  });

  it('knows an assumed concept practice has not contradicted', () => {
    expect(knows('a')).toBe(true);
    expect(knows('c')).toBe(true);
  });

  it('stops knowing one practice answered poorly, and never knows the unassumed', () => {
    expect(knows('b')).toBe(false);
    expect(knows('z')).toBe(false);
  });
});

describe('recommendPath', () => {
  it('picks the first written path whose rule fits the focus area and level', () => {
    const r = recommendPath(base);
    expect(r).toMatchObject({ kind: 'path', pathId: 'web-basics', firstLessonId: 'web.one' });
    expect(recommendPath({ ...base, level: 2 })).toMatchObject({ pathId: 'web-deep' });
  });

  it('starts on the first lesson not done and not placed out', () => {
    const r = recommendPath({
      ...base,
      isDone: (id) => id === 'web.one',
      isKnown: (c) => c === 'web.b',
    });
    expect(r.firstLessonId).toBe('web.three');
    expect(r.skipped).toEqual(['web.two']);
  });

  it('offers a draft of the path without the lessons placed out', () => {
    const r = recommendPath({ ...base, isKnown: (c) => c === 'web.a' });
    expect(r.draft).toEqual({
      name: 'Web basics, from your level',
      alternatives: [],
      summary: 'Web basics without the lessons your placement showed you know.',
      stages: [
        { title: 'Start', why: 'First steps.', lessonIds: ['web.two'] },
        { title: 'Then', why: 'Next.', lessonIds: ['web.three'] },
      ],
    });
  });

  it('builds a path from the area when no written path fits', () => {
    const r = recommendPath({
      ...base,
      focus: { id: 'servers', title: 'Servers', modules: ['api', 'db'] },
      isKnown: (c) => c === 'api.a',
    });
    expect(r.kind).toBe('built');
    expect(r.firstLessonId).toBe('api.two');
    expect(r.skipped).toEqual(['api.one']);
    expect(r.draft).toMatchObject({
      name: 'Servers, from your level',
      stages: [
        { title: 'APIs', lessonIds: ['api.two'] },
        { title: 'Data', lessonIds: ['db.one'] },
      ],
    });
  });

  it('builds from the area when the written path holds nothing left to learn', () => {
    const r = recommendPath({ ...base, isKnown: (c) => c.startsWith('web.') && c !== 'web.d' });
    expect(r).toMatchObject({ kind: 'path', firstLessonId: 'web.three' });
    const all = recommendPath({ ...base, isDone: (id) => id.startsWith('web.') });
    expect(all.kind).toBe('built');
    expect(all.firstLessonId).toBeUndefined();
  });

  it('caps a built path at 25 lessons', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `api.l${i}`,
      moduleId: 'api',
      concepts: [`api.c${i}`],
    }));
    const r = recommendPath({
      ...base,
      focus: { id: 'servers', title: 'Servers', modules: ['api'] },
      lessons: many,
    });
    expect(r.draft.stages.flatMap((s) => s.lessonIds)).toHaveLength(25);
  });
});
