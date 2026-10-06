import { describe, expect, it } from 'vitest';
import { ownPathSummary, restage, withOwnPaths, type CourseTree } from '@/features/paths/custom';
import type { OwnPath } from '@/core/progress';
import type { PathSummary } from '@/lib/content';

const lesson = (id: string) => ({
  id,
  title: id,
  objective: '',
  minutes: 10,
  href: `/learn/${id}`,
});
const tree: CourseTree = {
  parts: [
    {
      id: 'p1',
      title: 'Part one',
      summary: '',
      chapters: [
        {
          id: 'js',
          slug: 'javascript',
          title: 'JavaScript',
          lessons: [lesson('js.a'), lesson('js.b')],
        },
        { id: 'algo', slug: 'algorithms', title: 'Algorithms', lessons: [lesson('algo.a')] },
      ],
    },
  ],
};

const test = (key: string) => ({
  key,
  kind: 'test' as const,
  title: key,
  detail: '',
  minutes: 30,
  href: `/practise/online-test/${key}`,
  xp: 20,
});

// A written path whose stage teaches JavaScript and lists two tests.
const written = [
  {
    id: 'ts',
    stages: [
      {
        title: 'Traps',
        why: '',
        lessons: [lesson('js.a'), lesson('js.b'), lesson('algo.a')],
        optional: [],
        tests: [test('demo'), test('screen-a')],
      },
    ],
  },
] as unknown as PathSummary[];

describe('a built path', () => {
  it('gives each chapter the tests of the written stages that teach it', () => {
    const path = ownPathSummary(
      tree,
      { id: 'custom', name: 'My path', lessonIds: ['js.a', 'algo.a'] },
      written,
    );
    expect(path.stages.map((s) => s.title)).toEqual(['JavaScript', 'Algorithms']);
    const timed = (i: number) =>
      (path.stages[i]?.tests ?? []).filter((t) => t.kind !== 'lab').map((t) => t.key);
    expect(timed(0)).toEqual(['demo', 'screen-a']);
    // The stage's lessons are mostly JavaScript, so its tests go there, once.
    expect(timed(1)).toEqual([]);
  });

  it('adds the labs whose mechanism a chapter teaches', () => {
    const path = ownPathSummary(
      { parts: [{ ...tree.parts[0]!, chapters: [{ ...tree.parts[0]!.chapters[0]! }] }] },
      { id: 'custom', name: 'My path', lessonIds: ['js.a'] },
      [],
    );
    expect(path.stages[0]?.tests?.map((t) => t.key)).toContain('lab:event-loop-stepper');
  });

  it('keeps a planned path in its own stages and order, skipping lessons gone from the course', () => {
    const path = ownPathSummary(tree, {
      id: 'own-a1b2c3d4',
      name: 'Algorithms first',
      lessonIds: ['algo.a', 'js.b', 'gone.lesson'],
      stages: [
        { title: 'Warm up', why: 'Start where it is fun.', lessonIds: ['algo.a'] },
        { title: 'Then the language', lessonIds: ['js.b', 'gone.lesson'] },
        { title: 'Empty now', lessonIds: ['gone.lesson'] },
      ],
      summary: 'Puzzles first, then the language.',
    });
    expect(path.name).toBe('Algorithms first');
    expect(path.promise).toBe('Puzzles first, then the language.');
    expect(path.stages.map((s) => s.title)).toEqual(['Warm up', 'Then the language']);
    expect(path.lessonIds).toEqual(['algo.a', 'js.b']);
    expect(path.stages[0]?.lectureHref).toBe('/lectures/algorithms');
    expect(path.minutes).toBe(20);
  });

  it('gives a mixed stage no single lecture', () => {
    const path = ownPathSummary(tree, {
      id: 'own-a1b2c3d4',
      name: 'Mixed',
      lessonIds: ['algo.a', 'js.a'],
      stages: [{ title: 'Both', lessonIds: ['algo.a', 'js.a'] }],
    });
    expect(path.stages[0]?.lectureHref).toBeUndefined();
    expect(path.promise).toBe('Planned with Scout, in the order planned.');
  });

  it('keeps planned stages when lessons change in the builder', () => {
    const stages = [
      { title: 'One', lessonIds: ['js.a', 'js.b'] },
      { title: 'Two', lessonIds: ['algo.a'] },
    ];
    expect(restage(undefined, ['js.a'])).toBeUndefined();
    expect(restage(stages, ['js.b', 'algo.a', 'js.a'])).toEqual(stages);
    expect(restage(stages, ['js.a', 'new.one'])).toEqual([
      { title: 'One', lessonIds: ['js.a'] },
      { title: 'Added lessons', lessonIds: ['new.one'] },
    ]);
  });

  it('puts the learner own paths before the written ones', () => {
    const own = (id: string): OwnPath => ({ id, name: id, lessonIds: ['js.a'], origin: 'builder' });
    const all = withOwnPaths(
      tree,
      new Map([
        ['custom', own('custom')],
        ['own-a1b2c3d4', own('own-a1b2c3d4')],
      ]),
      written,
    );
    expect(all.map((p) => p.id)).toEqual(['custom', 'own-a1b2c3d4', 'ts']);
  });
});
