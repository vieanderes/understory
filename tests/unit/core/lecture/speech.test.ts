import { describe, expect, it } from 'vitest';
import type { Rich } from '@/core/content/compiled';
import type { LessonLecture } from '@/core/lecture';
import { codeCue, lessonScript, speakMarkdown } from '@/core/lecture';

const r = (md: string): Rich => ({ md, html: '' });

describe('speakMarkdown', () => {
  it('replaces code blocks with a cue that names the language', () => {
    expect(speakMarkdown('Look:\n\n```ts\nconst a = 1;\n```\n\nDone')).toBe(
      'Look:\n\nThere is a TypeScript example here, in the text.\n\nDone.',
    );
    expect(codeCue('rust')).toBe('There is a code example here, in the text.');
  });

  it('reads symbols in inline code as words, and drops markup', () => {
    expect(speakMarkdown('Use `a === b`, not `a == b`.')).toBe(
      'Use a triple equals b, not a double equals b.',
    );
    expect(speakMarkdown('**Bold** and *italic* and [a link](https://x.y)')).toBe(
      'Bold and italic and a link.',
    );
    expect(speakMarkdown('`max_tokens` and `arr.map((x) => x)`')).toBe(
      'max tokens and arr.map x arrow x.',
    );
  });

  it('says acronyms and complexity the way a person would', () => {
    expect(speakMarkdown('An API returns JSON in O(n) time, e.g. a list')).toBe(
      'An A P I returns Jason in O of n time, for example a list.',
    );
  });

  it('ends every line as a sentence and turns list markers into lines', () => {
    expect(speakMarkdown('- one\n- two\n## Heading')).toBe('one.\ntwo.\nHeading.');
  });
});

describe('lessonScript', () => {
  const lecture = {
    id: 'js.sample',
    title: 'Sample',
    objective: 'Read a sample.',
    opening: 'You will read.',
    remember: [r('Know this.')],
    blocks: [
      { kind: 'explanation', id: 'e', body: r('An idea.') },
      {
        kind: 'question',
        id: 'q',
        variant: 'predict',
        code: { html: '', language: 'js' },
        question: r('What prints?'),
        answer: r('`1`'),
        why: r('Because.'),
        wrong: [],
      },
      {
        kind: 'trace',
        id: 't',
        prompt: r('Trace it.'),
        code: { html: '', language: 'js' },
        columns: [],
        rows: [],
      },
      {
        kind: 'completed',
        id: 'c',
        variant: 'parsons',
        prompt: r('Order it.'),
        solution: [],
        leftOut: [],
      },
      {
        kind: 'bug',
        id: 'b',
        variant: 'bug-hunt',
        prompt: r('Find it.'),
        code: { html: '', language: 'js' },
        lines: [2],
        answer: r('Off by one.'),
        why: r('It skips the last.'),
        wrong: [],
      },
      {
        kind: 'exercise',
        id: 'x',
        variant: 'code',
        prompt: r('Write it.'),
        hints: [],
        solution: [{ code: 'x', html: '', language: 'js' }],
      },
      { kind: 'exercise', id: 'p', variant: 'page', prompt: r('Play.'), hints: [], solution: [] },
      { kind: 'model-answer', id: 'm', prompt: r('Explain.'), points: [], answer: r('Like so.') },
    ],
    deeper: [{ title: r('Underneath'), body: r('How.') }],
    pitfalls: [r('A mistake.')],
    verify: [
      { lens: 'breaks', label: 'What breaks', checks: [r('A cold start floods it.')] },
      {
        lens: 'tests',
        label: 'How to test it',
        checks: [r('Assert the refill.'), r('Expire a key.')],
      },
    ],
    interview: [{ question: r('Why?'), answer: r('Because.') }],
    flashcards: [{ id: 'f', front: r('Q?'), back: r('A.') }],
  } as unknown as LessonLecture;

  it('reads the lecture in page order, with code and solutions named, not read', () => {
    const script = lessonScript(lecture, 'JavaScript, lesson 2');
    expect(script.split('\n\n')).toEqual([
      'Sample. JavaScript, lesson 2.',
      'Read a sample.',
      'The big picture.',
      'You will read.',
      'Remember.',
      'First. Know this.',
      'The lesson, step by step.',
      'An idea.',
      'A question. What prints?',
      'There is a JavaScript example here, in the text.',
      'The answer: 1.',
      'Because.',
      'A trace exercise. Trace it.',
      'The full trace table is in the text.',
      'Order it.',
      'The completed code is in the text.',
      'Find the bug. Find it.',
      'The fault is on line 2. Off by one.',
      'It skips the last.',
      'An exercise. Write it.',
      'The full solution is in the text.',
      'An exercise. Play.',
      'Explain it. Explain.',
      'A model answer. Like so.',
      'Going deeper.',
      'Underneath.',
      'How.',
      'Common mistakes.',
      'A mistake.',
      'Before you ship.',
      'What breaks. A cold start floods it.',
      'How to test it. Assert the refill. Expire a key.',
      'Interview questions.',
      'Question 1. Why?',
      'Answer. Because.',
      'Test yourself. Say your answer before you hear mine.',
      'Q?',
      'Answer. A.',
    ]);
  });

  it('prefers the notes summary, and leaves out empty sections', () => {
    const bare = {
      ...lecture,
      summary: r('The picture.'),
      remember: [],
      blocks: [],
      deeper: [],
      pitfalls: [],
      verify: [],
      interview: [],
      flashcards: [],
    } as LessonLecture;
    expect(lessonScript(bare).split('\n\n')).toEqual([
      'Sample.',
      'Read a sample.',
      'The big picture.',
      'The picture.',
      'The lesson, step by step.',
    ]);
  });
});
