import { describe, expect, it } from 'vitest';
import type {
  CompiledChoice,
  CompiledLectureExtras,
  CompiledLesson,
  CompiledPortableStep,
  CompiledStep,
  Rich,
} from '@/core/content/compiled';
import { buildLessonLecture, readingWords } from '@/core/lecture';

const r = (md: string): Rich => ({ md, html: `<p>${md}</p>` });
const choice = (text: string, correct = false): CompiledChoice => ({
  text: r(text),
  feedback: r(`why ${text}`),
  ...(correct ? { correct: true } : {}),
});

const predict: CompiledPortableStep = {
  type: 'predict-output',
  id: 'predict',
  concept: 'js.x',
  difficulty: 1,
  code: 'console.log(1)',
  codeHtml: '<pre>console.log(1)</pre>',
  language: 'js',
  question: r('What prints?'),
  choices: [choice('2'), choice('1', true), choice('undefined')],
};

const steps: CompiledStep[] = [
  {
    type: 'prose',
    id: 'intro',
    body: r('An idea.'),
    figure: { id: 'call-stack', caption: 'See it.' },
  },
  predict,
  {
    type: 'multiple-choice',
    id: 'mc',
    concept: 'js.x',
    difficulty: 1,
    question: r('Which?'),
    choices: [choice('a', true), choice('b')],
  },
  {
    type: 'trace-table',
    id: 'trace',
    concept: 'js.x',
    difficulty: 2,
    code: 'let i = 0',
    codeHtml: '<pre>let i = 0</pre>',
    language: 'js',
    prompt: r('Trace it.'),
    columns: ['i'],
    rows: [{ line: 1, values: ['0'], given: true }],
  },
  {
    type: 'fill-blank',
    id: 'fill',
    concept: 'js.x',
    difficulty: 2,
    prompt: r('Fill it.'),
    template: 'let {{1}} = 1',
    templateHtml: '<pre>let <span data-blank="1"></span> = 1</pre>',
    language: 'js',
    blanks: [{ key: '1', answer: 'x' }],
    bank: ['x', 'y'],
  },
  {
    type: 'parsons',
    id: 'order',
    concept: 'js.x',
    difficulty: 2,
    prompt: r('Order it.'),
    language: 'js',
    blocks: [{ id: 'a', code: 'a()', codeHtml: '<pre>a()</pre>' }],
    distractors: [{ id: 'z', code: 'z()', codeHtml: '<pre>z()</pre>', feedback: r('Not needed.') }],
  },
  {
    type: 'ai-review',
    id: 'review',
    concept: 'js.x',
    difficulty: 3,
    code: 'eval(input)',
    codeHtml: '<pre>eval(input)</pre>',
    language: 'js',
    prompt: r('Review it.'),
    request: 'Parse the input',
    flawClass: 'security',
    lines: [1],
    reasons: [choice('It runs input as code', true), choice('It is slow')],
    fix: 'JSON.parse(input)',
    fixHtml: '<pre>JSON.parse(input)</pre>',
  },
  {
    type: 'bug-hunt',
    id: 'bug',
    concept: 'js.x',
    difficulty: 3,
    code: 'x',
    codeHtml: '<pre>x</pre>',
    language: 'js',
    prompt: r('Find it.'),
    lines: [1],
    reasons: [choice('Undefined', true), choice('Fine')],
  },
  {
    type: 'code-challenge',
    id: 'write',
    concept: 'js.x',
    difficulty: 4,
    language: 'js',
    prompt: r('Write it.'),
    starterCode: 'function f() {}',
    starterHtml: '<pre>function f() {}</pre>',
    testsCode: '',
    hints: [r('Start small.')],
  },
  {
    type: 'explain-back',
    id: 'explain',
    concept: 'js.x',
    difficulty: 3,
    prompt: r('Explain it.'),
    rubric: ['Names the cause'],
    modelAnswer: r('Because.'),
  },
  {
    type: 'lab',
    id: 'lab',
    concept: 'js.x',
    lab: 'event-loop-stepper',
    intro: r('Step through it.'),
    checkpoint: {
      question: r('Which runs first?'),
      choices: [choice('sync', true), choice('timer')],
      difficulty: 2,
    },
    fallback: { ...predict, id: 'lab-fallback' },
  },
  {
    type: 'incident',
    id: 'incident',
    concept: 'js.x',
    difficulty: 3,
    incident: 'x',
    fallback: { ...predict, id: 'incident-fallback' },
  },
  {
    type: 'playground',
    id: 'page',
    prompt: r('Fix the page.'),
    editable: ['css'],
    hints: [r('Look at the margin.')],
  },
  { type: 'sql', id: 'query', prompt: r('Query it.'), setup: '', starter: '' },
];

const lesson: CompiledLesson = {
  schema: 1,
  id: 'js.sample',
  moduleId: 'js',
  moduleSlug: 'javascript',
  slug: 'sample',
  title: 'Sample',
  objective: 'Read a sample.',
  level: 'essential',
  minutes: 10,
  concepts: ['js.x'],
  prerequisites: [],
  opening: { text: 'You will read. It helps.' },
  steps,
  recap: [r('One.'), r('Two.'), r('Three.')],
  recall: [{ id: 'card', concept: 'js.x', front: r('Q?'), back: r('A.') }],
  references: [{ title: 'MDN', url: 'https://developer.mozilla.org', kind: 'docs' } as never],
  deepDive: r('More depth.'),
};

const extras: CompiledLectureExtras = {
  schema: 1,
  lessonId: 'js.sample',
  notes: {
    summary: r('The big picture.'),
    remember: [r('Know this.')],
    sections: [{ title: r('Underneath'), body: r('How it works.') }],
    pitfalls: [r('A mistake.')],
    interview: [{ question: r('Why?'), answer: r('Because.') }],
    verify: [
      { lens: 'tests', check: r('Assert the refill.') },
      { lens: 'breaks', check: r('A cold start floods it.') },
      { lens: 'tests', check: r('Expire a key first.') },
    ],
  },
  solutions: {
    fill: [{ code: 'let x = 1', html: '<pre>let x = 1</pre>', language: 'js' }],
    order: [{ code: 'a()', html: '<pre>a()</pre>', language: 'js' }],
    write: [{ code: 'function f() { return 1 }', html: '<pre>f</pre>', language: 'js' }],
    page: [{ label: 'CSS', code: 'p {}', html: '<pre>p {}</pre>', language: 'css' }],
    query: [{ code: 'select 1', html: '<pre>select 1</pre>', language: 'sql' }],
  },
};

describe('buildLessonLecture', () => {
  const lecture = buildLessonLecture(lesson, extras);
  const block = (id: string) => lecture.blocks.find((b) => b.id === id);

  it('keeps every step, in order, with a lab split into intro, checkpoint and stand-in', () => {
    expect(lecture.blocks.map((b) => b.id)).toEqual([
      'intro',
      'predict',
      'mc',
      'trace',
      'fill',
      'order',
      'review',
      'bug',
      'write',
      'explain',
      'lab-intro',
      'lab-checkpoint',
      'lab-fallback',
      'incident-fallback',
      'page',
      'query',
    ]);
  });

  it('shows a question with its right answer, the reason, and why the others are wrong', () => {
    expect(block('predict')).toMatchObject({
      kind: 'question',
      variant: 'predict',
      answer: { md: '1' },
      why: { md: 'why 1' },
      wrong: [
        { answer: { md: '2' }, why: { md: 'why 2' } },
        { answer: { md: 'undefined' }, why: { md: 'why undefined' } },
      ],
    });
    expect(block('mc')).not.toHaveProperty('code');
    expect(block('lab-checkpoint')).toMatchObject({
      variant: 'checkpoint',
      answer: { md: 'sync' },
    });
  });

  it('fills gaps, orders blocks and names the lines that do not belong', () => {
    expect(block('fill')).toMatchObject({ kind: 'completed', solution: [{ code: 'let x = 1' }] });
    expect(block('order')).toMatchObject({
      variant: 'parsons',
      leftOut: [{ code: { html: '<pre>z()</pre>' }, why: { md: 'Not needed.' } }],
    });
  });

  it('points at the faulty line with its reason and the fix', () => {
    expect(block('review')).toMatchObject({
      kind: 'bug',
      request: 'Parse the input',
      lines: [1],
      answer: { md: 'It runs input as code' },
      fix: { html: '<pre>JSON.parse(input)</pre>' },
    });
    expect(block('bug')).not.toHaveProperty('fix');
    expect(block('bug')).not.toHaveProperty('request');
  });

  it('prints exercises with their starter, hints and full solution', () => {
    expect(block('write')).toMatchObject({
      kind: 'exercise',
      variant: 'code',
      starter: { html: '<pre>function f() {}</pre>' },
      solution: [{ code: 'function f() { return 1 }' }],
    });
    expect(block('page')).toMatchObject({ variant: 'page', solution: [{ label: 'CSS' }] });
    expect(block('query')).toMatchObject({ variant: 'sql', hints: [] });
    expect(block('explain')).toMatchObject({ kind: 'model-answer', points: ['Names the cause'] });
    expect(block('trace')).toMatchObject({ rows: [{ line: 1, values: ['0'] }] });
  });

  it('takes the big picture, the remember list and the depth from the notes', () => {
    expect(lecture.hasNotes).toBe(true);
    expect(lecture.summary?.md).toBe('The big picture.');
    expect(lecture.remember.map((line) => line.md)).toEqual(['Know this.']);
    expect(lecture.deeper).toHaveLength(1);
    expect(lecture.pitfalls).toHaveLength(1);
    expect(lecture.interview).toHaveLength(1);
    expect(lecture.flashcards).toEqual([{ id: 'card', front: r('Q?'), back: r('A.') }]);
    expect(lecture.deepDive?.md).toBe('More depth.');
    expect(lecture.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it('groups the before-you-ship checks by lens, in the lens order', () => {
    expect(lecture.verify).toEqual([
      { lens: 'breaks', label: 'What breaks', checks: [r('A cold start floods it.')] },
      {
        lens: 'tests',
        label: 'How to test it',
        checks: [r('Assert the refill.'), r('Expire a key first.')],
      },
    ]);
    expect(buildLessonLecture(lesson).verify).toEqual([]);
  });

  it('falls back to the opening and the recap without notes', () => {
    const plain = buildLessonLecture({
      ...lesson,
      recap: undefined,
      deepDive: undefined,
    } as CompiledLesson);
    expect(plain.hasNotes).toBe(false);
    expect(plain.summary).toBeUndefined();
    expect(plain.opening).toBe('You will read. It helps.');
    expect(plain.remember).toEqual([]);
    expect(plain.deepDive).toBeUndefined();
    expect(plain.blocks.find((b) => b.id === 'write')).toMatchObject({ solution: [] });
    expect(buildLessonLecture(lesson).remember.map((line) => line.md)).toEqual([
      'One.',
      'Two.',
      'Three.',
    ]);
  });

  it('refuses a choice step with no choices', () => {
    const broken = { ...lesson, steps: [{ ...predict, choices: [] }] } as CompiledLesson;
    expect(() => buildLessonLecture(broken)).toThrow(/no choices/);
  });

  it('falls back to the first choice when none is marked right', () => {
    const unmarked = { ...lesson, steps: [{ ...predict, choices: [choice('a'), choice('b')] }] };
    expect(buildLessonLecture(unmarked).blocks[0]).toMatchObject({ answer: { md: 'a' } });
  });
});

describe('readingWords', () => {
  it('counts prose words and weighs each line of code as four', () => {
    expect(readingWords('Two words')).toBe(2);
    expect(readingWords('One\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n')).toBe(1 + 8);
    expect(readingWords('— 42 !')).toBe(1);
  });
});
