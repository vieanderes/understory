import { describe, expect, it } from 'vitest';
import { explanationsFrom, milestoneMarkdown, type MilestoneInput } from '@/core/insight';
import { makeEvent, type EventType, type PayloadOf, type StoryEvent } from '@/core/progress';

let seq = 0;
function event<T extends EventType>(at: string, type: T, payload: PayloadOf<T>): StoryEvent {
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

const explained = (at: string, lessonId: string, stepId: string, text?: string) =>
  event(at, 'explain_back_graded', {
    lessonId,
    stepId,
    concept: `${lessonId.split('.')[0]}.concept`,
    rubricHits: 2,
    ...(text === undefined ? {} : { text }),
  });

describe('explanationsFrom', () => {
  it('keeps the latest written explanation of each step, in the order of the lessons', () => {
    const events = [
      explained('2026-09-20T10:00:00Z', 'basics.two', 'explain', 'Old words.'),
      explained('2026-09-21T10:00:00Z', 'basics.two', 'explain', 'New words.'),
      explained('2026-09-19T10:00:00Z', 'basics.one', 'explain', 'A loop repeats.'),
      explained('2026-09-19T11:00:00Z', 'basics.one', 'why', '   '),
      explained('2026-09-19T12:00:00Z', 'basics.one', 'silent'),
      explained('2026-09-19T12:00:00Z', 'css.one', 'explain', 'Not in this part.'),
      { type: 'unknown' as const, originalType: 'later', reason: 'newer', raw: {} },
    ];
    expect(explanationsFrom(events, ['basics.one', 'basics.two'])).toEqual([
      { lessonId: 'basics.one', stepId: 'explain', text: 'A loop repeats.' },
      { lessonId: 'basics.two', stepId: 'explain', text: 'New words.' },
    ]);
  });
});

describe('milestoneMarkdown', () => {
  const input: MilestoneInput = {
    title: 'First code',
    summary: 'You can write small programs.',
    date: '2026-09-23',
    canBuild: [
      { module: 'First steps in JavaScript', youCanBuild: 'A small to-do list program.' },
      { module: 'HTML', youCanBuild: 'A semantic page.' },
    ],
    capstone: { title: 'A reading list page', brief: 'Build one page that lists books.' },
    concepts: [
      { title: 'Values', state: 'solid' },
      { title: 'Loops | and pipes', state: 'practised' },
    ],
    notes: [{ lesson: 'Repeating things', text: 'A loop repeats.\nUntil it stops.' }],
  };

  it('writes the part, what it lets you build, the capstone, the concepts and the notes', () => {
    expect(milestoneMarkdown(input)).toBe(
      [
        '# First code',
        '',
        'You can write small programs.',
        '',
        'Finished on 2026-09-23.',
        '',
        '## What I can build now',
        '',
        '- **First steps in JavaScript.** A small to-do list program.',
        '- **HTML.** A semantic page.',
        '',
        '## Capstone: A reading list page',
        '',
        'Build one page that lists books.',
        '',
        '## Concepts',
        '',
        '1 of 2 Solid or better.',
        '',
        '| Concept | State |',
        '| --- | --- |',
        '| Values | Solid |',
        '| Loops \\| and pipes | Practised |',
        '',
        '## My notes',
        '',
        '### Repeating things',
        '',
        '> A loop repeats.',
        '> Until it stops.',
        '',
      ].join('\n'),
    );
  });

  it('says so when there are no notes yet', () => {
    expect(milestoneMarkdown({ ...input, notes: [] })).toContain(
      '## My notes\n\nNo written explanations yet.',
    );
  });
});
