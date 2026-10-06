import { describe, expect, it } from 'vitest';
import { customPathSummary, type CourseTree } from '@/features/paths/custom';
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
    const path = customPathSummary(tree, ['js.a', 'algo.a'], written);
    expect(path.stages.map((s) => s.title)).toEqual(['JavaScript', 'Algorithms']);
    const timed = (i: number) =>
      (path.stages[i]?.tests ?? []).filter((t) => t.kind !== 'lab').map((t) => t.key);
    expect(timed(0)).toEqual(['demo', 'screen-a']);
    // The stage's lessons are mostly JavaScript, so its tests go there, once.
    expect(timed(1)).toEqual([]);
  });

  it('adds the labs whose mechanism a chapter teaches', () => {
    const path = customPathSummary(
      { parts: [{ ...tree.parts[0]!, chapters: [{ ...tree.parts[0]!.chapters[0]! }] }] },
      ['js.a'],
      [],
    );
    expect(path.stages[0]?.tests?.map((t) => t.key)).toContain('lab:event-loop-stepper');
  });
});
