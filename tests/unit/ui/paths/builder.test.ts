import { describe, expect, it } from 'vitest';
import {
  allLessonIds,
  chapterMeta,
  partMeta,
  sameChoice,
  summary,
  totals,
  totalsLine,
} from '@/features/paths/builder';
import type { CourseTree } from '@/features/paths/custom';

function lesson(id: string, minutes = 10) {
  return { id, title: id, objective: '', minutes, href: `/learn/x/${id}` };
}

const tree: CourseTree = {
  parts: [
    {
      id: 'p1',
      title: 'Foundations',
      summary: 'Read and write code.',
      chapters: [
        { id: 'c1', slug: 'c1', title: 'Values', lessons: [lesson('a', 30), lesson('b', 30)] },
        { id: 'c2', slug: 'c2', title: 'Loops', lessons: [lesson('c', 50)] },
      ],
    },
    {
      id: 'p2',
      title: 'The web',
      summary: 'Build pages.',
      chapters: [{ id: 'c3', slug: 'c3', title: 'HTML', lessons: [lesson('d', 5)] }],
    },
  ],
};

describe('path builder', () => {
  it('sizes an untouched part by chapters, lessons and time', () => {
    expect(partMeta(tree.parts[0]!, new Set())).toBe('2 chapters · 3 lessons · about 1 h 50 min');
    expect(partMeta(tree.parts[1]!, new Set(['d']))).toBe('1 chapter · 1 lesson · about 5 min');
  });

  it('says how much of a part is chosen when only some is', () => {
    expect(partMeta(tree.parts[0]!, new Set(['a']))).toBe('1 of 3 lessons chosen');
  });

  it('sizes a chapter, or counts what is chosen in it', () => {
    const values = tree.parts[0]!.chapters[0]!;
    expect(chapterMeta(values, new Set())).toBe('2 lessons · 1 h');
    expect(chapterMeta(values, new Set(['b']))).toBe('1 of 2 chosen');
    expect(chapterMeta(tree.parts[0]!.chapters[1]!, new Set())).toBe('1 lesson · 50 min');
  });

  it('totals the chosen lessons in course order', () => {
    expect(totals(tree, new Set(['d', 'a']))).toEqual({
      lessonIds: ['a', 'd'],
      lessons: 2,
      minutes: 35,
    });
    expect(totalsLine(2, 35)).toBe('2 lessons · about 35 min');
    expect(totalsLine(1, 5)).toBe('1 lesson · about 5 min');
    expect(totalsLine(0, 0)).toBe('Nothing chosen yet');
  });

  it('lists only the chapters with something chosen, under their parts', () => {
    expect(summary(tree, new Set(['b', 'd']))).toEqual([
      {
        id: 'p1',
        title: 'Foundations',
        chapters: [{ id: 'c1', title: 'Values', chosen: 1, total: 2 }],
      },
      { id: 'p2', title: 'The web', chapters: [{ id: 'c3', title: 'HTML', chosen: 1, total: 1 }] },
    ]);
    expect(summary(tree, new Set())).toEqual([]);
  });

  it('knows every lesson and when two choices are the same', () => {
    expect(allLessonIds(tree)).toEqual(['a', 'b', 'c', 'd']);
    expect(sameChoice(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(sameChoice(new Set(['a']), new Set(['a', 'b']))).toBe(false);
    expect(sameChoice(new Set(['a', 'c']), new Set(['a', 'b']))).toBe(false);
  });
});
