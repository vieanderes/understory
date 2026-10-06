import { describe, expect, it } from 'vitest';
import { progressScopes, resolveScope, type ScopePath } from '@/core/insight';
import { course } from './fixture';

const interviews: ScopePath = {
  id: 'coding-rounds',
  name: 'Coding rounds',
  lessonIds: ['js.closures', 'cs.big-o', 'gone.lesson'],
  timedTests: true,
};
const mine: ScopePath = {
  id: 'custom',
  name: 'My path',
  lessonIds: ['db.index', 'js.scope'],
  timedTests: false,
};

describe('progressScopes', () => {
  it('offers everything, then each part, when nothing else is known', () => {
    const scopes = progressScopes({ catalog: course, paths: [], interests: [] });
    expect(scopes.map((s) => s.id)).toEqual(['all', 'part-code', 'part-data']);
    const all = scopes[0]!;
    expect(all.label).toBe('Everything');
    expect(all.lessonIds).toEqual(Object.keys(course.lessons));
    expect(all.conceptIds).toHaveLength(course.concepts.length);
    expect(all.partIds).toEqual(['code', 'data']);
    expect(all.timedTests).toBe(true);
    expect(all.topic).toBeUndefined();
  });

  it('puts the current path first and counts only its published lessons, in course order', () => {
    const scopes = progressScopes({
      catalog: course,
      path: interviews,
      paths: [interviews],
      interests: [],
    });
    const path = scopes[0]!;
    expect(path.id).toBe('path');
    expect(path.kind).toBe('path');
    expect(path.label).toBe('Coding rounds');
    expect(path.lessonIds).toEqual(['js.closures', 'cs.big-o']);
    expect(path.conceptIds).toEqual(['js.closures', 'cs.big-o']);
    expect(path.partIds).toEqual(['code']);
    expect(path.examPathIds).toEqual(['coding-rounds']);
    expect(path.timedTests).toBe(true);
    expect(scopes[1]!.examPathIds).toEqual(['coding-rounds']);
  });

  it('gives a path the learner built no exam', () => {
    const [path] = progressScopes({ catalog: course, path: mine, paths: [], interests: [] });
    expect(path!.examPathIds).toEqual([]);
    expect(path!.timedTests).toBe(false);
    expect(path!.partIds).toEqual(['code', 'data']);
  });

  it('adds one scope per interest, with its topic and tests only where they fit', () => {
    const scopes = progressScopes({
      catalog: course,
      paths: [],
      interests: ['backend', 'algorithms'],
    });
    const backend = scopes.find((s) => s.id === 'topic-backend')!;
    expect(backend.kind).toBe('topic');
    expect(backend.label).toBe('Servers and data');
    expect(backend.lessonIds).toEqual(['db.joins', 'db.index']);
    expect(backend.topic).toBe('backend');
    expect(backend.timedTests).toBe(false);
    const algorithms = scopes.find((s) => s.id === 'topic-algorithms')!;
    expect(algorithms.lessonIds).toEqual(['cs.big-o']);
    expect(algorithms.timedTests).toBe(true);
  });

  it('scopes a part to its own lessons and concepts', () => {
    const scopes = progressScopes({ catalog: course, paths: [], interests: [] });
    const data = scopes.find((s) => s.id === 'part-data')!;
    expect(data.kind).toBe('part');
    expect(data.label).toBe('Part 2: Data');
    expect(data.lessonIds).toEqual(['db.joins', 'db.index']);
    expect(data.conceptIds).toEqual(['db.joins', 'db.index']);
    expect(data.partIds).toEqual(['data']);
    expect(data.timedTests).toBe(false);
  });
});

describe('resolveScope', () => {
  const withPath = progressScopes({ catalog: course, path: mine, paths: [], interests: [] });
  const without = progressScopes({ catalog: course, paths: [], interests: [] });

  it('finds the scope the URL names', () => {
    expect(resolveScope(withPath, 'part-data').id).toBe('part-data');
  });

  it('defaults to the path, else to everything', () => {
    expect(resolveScope(withPath, null).id).toBe('path');
    expect(resolveScope(without, undefined).id).toBe('all');
    expect(resolveScope(without, 'path').id).toBe('all');
  });
});
