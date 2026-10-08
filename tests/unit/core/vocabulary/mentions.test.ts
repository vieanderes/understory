import { describe, expect, it } from 'vitest';
import { findMentions, type LessonSpots } from '@/core/vocabulary/mentions';

const lessons: LessonSpots[] = [
  {
    lessonId: 'js.scope',
    spots: [
      {
        anchor: 'js.scope-lesson',
        label: 'The lesson',
        text: 'A closure is mentioned here.',
        strength: 1,
      },
    ],
  },
  {
    lessonId: 'js.closures',
    spots: [
      {
        anchor: 'js.closures-lesson',
        label: 'The lesson',
        text: 'Closures, step by step.',
        strength: 1,
      },
      { anchor: 'js.closures-terms', label: 'Terms', text: 'closure', strength: 4 },
    ],
  },
  {
    lessonId: 'js.loops',
    spots: [
      {
        anchor: 'js.loops-lesson',
        label: 'The lesson',
        text: 'Loops and enclosures.',
        strength: 1,
      },
    ],
  },
  {
    lessonId: 'js.timers',
    spots: [
      {
        anchor: 'js.timers-deeper-0',
        label: 'Timers and closures',
        text: 'A closure keeps the id.',
        strength: 3,
      },
    ],
  },
];

describe('findMentions', () => {
  it('ranks lessons by their strongest spot, then by course order', () => {
    expect(findMentions(['closure'], lessons).map((m) => m.lessonId)).toEqual([
      'js.closures',
      'js.timers',
      'js.scope',
    ]);
  });

  it('breaks a tie by how often the lesson says the word', () => {
    const tied: LessonSpots[] = [
      { lessonId: 'a', spots: [{ anchor: 'a', label: 'A', text: 'one closure', strength: 2 }] },
      {
        lessonId: 'b',
        spots: [{ anchor: 'b', label: 'B', text: 'closure, closures, closure', strength: 2 }],
      },
    ];
    expect(findMentions(['closure'], tied).map((m) => m.lessonId)).toEqual(['b', 'a']);
  });

  it('links each lesson to its strongest spot', () => {
    const [first] = findMentions(['closure'], lessons);
    expect(first).toEqual({
      lessonId: 'js.closures',
      anchor: 'js.closures-terms',
      label: 'Terms',
      pinned: false,
    });
  });

  it('puts pinned lessons first, even where the text never says the word', () => {
    const found = findMentions(['closure'], lessons, ['js.loops', 'js.scope']);
    expect(found.slice(0, 2)).toEqual([
      { lessonId: 'js.loops', anchor: null, label: null, pinned: true },
      { lessonId: 'js.scope', anchor: 'js.scope-lesson', label: 'The lesson', pinned: true },
    ]);
    expect(found).toHaveLength(4);
  });

  it('stops at the limit and ignores a pinned id with no lesson', () => {
    expect(findMentions(['closure'], lessons, ['js.nowhere'], 2)).toHaveLength(2);
    expect(findMentions(['closure'], lessons, ['js.nowhere']).map((m) => m.lessonId)).not.toContain(
      'js.nowhere',
    );
  });

  it('finds nothing for a word nobody says', () => {
    expect(findMentions(['monad'], lessons)).toEqual([]);
  });
});
