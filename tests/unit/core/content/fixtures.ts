import type { IdsLock, RawCatalog, RawLesson, RawModule } from '@/core/content/catalog';
import { nextLock } from '@/core/content/lock';
import { courseSchema, lessonSchema, moduleSchema } from '@/core/content/schema';
import type { Lesson, Step } from '@/core/content/schema';

/*
 * The smallest catalog that passes every rule with no warnings. Each builder returns fresh
 * objects, so a test changes one thing and nothing leaks into the next test.
 */

const CART_CODE = ['const quantity = "2";', 'const total = quantity + 1;', 'console.log(total);'].join(
  '\n',
);

const choices = () => [
  { text: '`"21"`', correct: true, feedback: 'A string operand makes `+` join text.' },
  { text: '`3`', feedback: 'You predicted addition. One operand is a string, so `+` joins.' },
];

export function validLessonInput(): Record<string, unknown> {
  return {
    id: 'js.coercion',
    title: 'Values, types and coercion',
    objective: 'Predict the result of `+` on mixed types.',
    level: 'essential',
    minutes: 12,
    concepts: ['js.coercion'],
    opening: { text: 'The cart shows 21 for two books plus postage.' },
    steps: [
      { type: 'prose', id: 'intro', body: 'The quantity field holds text, not a number.' },
      {
        type: 'predict-output',
        id: 'predict-total',
        concept: 'js.coercion',
        difficulty: 1,
        code: CART_CODE,
        language: 'js',
        question: 'What does this log?',
        choices: choices(),
      },
      {
        type: 'trace-table',
        id: 'trace-total',
        concept: 'js.coercion',
        difficulty: 2,
        code: CART_CODE,
        language: 'js',
        prompt: 'Fill in the value after each line.',
        columns: ['quantity', 'total'],
        rows: [
          { line: 1, values: ['"2"', 'undefined'], given: true },
          { line: 2, values: ['"2"', '"21"'] },
        ],
      },
      {
        type: 'multiple-choice',
        id: 'pick-rule',
        concept: 'js.coercion',
        difficulty: 2,
        question: 'Which operand decides that `+` joins text?',
        choices: choices(),
      },
      {
        type: 'fill-blank',
        id: 'fill-number',
        concept: 'js.coercion',
        difficulty: 2,
        prompt: 'Make the total a number.',
        template: 'const total = {{1}}(quantity) + {{2}};',
        language: 'js',
        blanks: [
          { key: '1', answer: 'Number' },
          { key: '2', answer: '1' },
        ],
        bank: ['Number', '1', 'String'],
      },
      {
        type: 'parsons',
        id: 'arrange-total',
        concept: 'js.coercion',
        difficulty: 3,
        prompt: 'Arrange the lines so the total is a number.',
        language: 'js',
        blocks: [
          { id: 'read', code: 'const raw = "2";', subgoal: 'Read the input' },
          { id: 'convert', code: 'const quantity = Number(raw);', subgoal: 'Convert it' },
          { id: 'add', code: 'const total = quantity + 1;' },
        ],
        distractors: [
          { id: 'join', code: 'const total = raw + 1;', feedback: 'This joins text.' },
        ],
      },
      {
        type: 'bug-hunt',
        id: 'hunt-total',
        concept: 'js.coercion',
        difficulty: 3,
        code: CART_CODE,
        language: 'js',
        prompt: 'The cart shows 21. Tap the line at fault.',
        lines: [2],
        reasons: choices(),
      },
      {
        type: 'ai-review',
        id: 'review-total',
        concept: 'js.coercion',
        difficulty: 3,
        code: CART_CODE,
        language: 'js',
        prompt: 'Find the flaw in this generated code.',
        lines: [2],
        reasons: choices(),
        request: 'Add the booking fee to the quantity.',
        flawClass: 'logic',
      },
      {
        type: 'code-challenge',
        id: 'write-total',
        concept: 'js.coercion',
        difficulty: 4,
        prompt: 'Write `cartTotal`. It returns a number.',
        language: 'ts',
        hints: ['Look at the input type.', 'Notice the quotes.', 'Start with `Number`.'],
      },
      {
        type: 'lab',
        id: 'lab-coercion',
        concept: 'js.coercion',
        lab: 'coercion-table',
        intro: 'Try each pair of operands.',
        checkpoint: { question: 'What does the table show?', choices: choices(), difficulty: 2 },
        fallback: {
          type: 'multiple-choice',
          id: 'lab-coercion-fallback',
          concept: 'js.coercion',
          difficulty: 2,
          question: 'Which pair joins text?',
          choices: choices(),
        },
      },
      {
        type: 'explain-back',
        id: 'explain-total',
        concept: 'js.coercion',
        difficulty: 3,
        prompt: 'Why does the cart show 21?',
        rubric: ['The input is a string.', '`+` joins when one side is a string.', 'Convert first.'],
        modelAnswer: 'The field holds a string, so `+` joins text. Convert with `Number` first.',
      },
    ],
    recall: [
      { id: 'card-1', concept: 'js.coercion', front: 'What does `"2" + 1` give?', back: '`"21"`.' },
      { id: 'card-2', concept: 'js.coercion', front: 'What does `"2" * 1` give?', back: '`2`.' },
      { id: 'card-3', concept: 'js.coercion', front: 'What does `Number("")` give?', back: '`0`.' },
    ],
    references: [{ kind: 'spec', title: 'ECMAScript Language Specification' }],
  };
}

export const CHALLENGE_FILES = {
  'starter.ts': 'export function cartTotal(): number {\n  return 0;\n}\n',
  'solution.ts': 'export function cartTotal(): number {\n  return 3;\n}\n',
  'tests.ts': "import { cartTotal } from './solution';\ntest('adds', () => expect(cartTotal()).toBe(3));\n",
};

export function validLesson(): Lesson {
  return lessonSchema.parse(validLessonInput());
}

export function rawLesson(data: Lesson = validLesson()): RawLesson {
  return {
    path: 'content/course/03-javascript/01-coercion/lesson.yaml',
    slug: 'coercion',
    order: 1,
    data,
    files: { ...CHALLENGE_FILES },
  };
}

export function rawModule(lessons: RawLesson[] = [rawLesson()]): RawModule {
  return {
    path: 'content/course/03-javascript/module.yaml',
    slug: 'javascript',
    order: 3,
    data: moduleSchema.parse({
      id: 'js',
      number: 3,
      title: 'JavaScript',
      summary: 'The language of the cart.',
      why: 'Every later chapter builds on it.',
      youCanBuild: 'A client-side cart.',
      concepts: [
        { id: 'js.coercion', title: 'Type coercion', summary: 'Implicit conversion.' },
        { id: 'js.equality', title: 'Equality', summary: 'Loose and strict comparison.' },
      ],
    }),
    lessons,
  };
}

/** Without a lock, for tests about the lock itself. */
export function unlockedCatalog(): RawCatalog {
  return {
    course: {
      path: 'content/course/course.yaml',
      data: courseSchema.parse({ title: 'The course', summary: 'From a page to a system.' }),
      modules: [rawModule()],
    },
  };
}

/** A lock that matches the content, so an untouched fixture has no issues at all. */
export function validCatalog(): RawCatalog {
  const catalog = unlockedCatalog();
  const lock: IdsLock = nextLock(catalog, undefined);
  return { ...catalog, lock };
}

/** The only lesson of the fixture catalog. Throws when a test has removed it. */
export function lessonOf(catalog: RawCatalog): RawLesson {
  const lesson = catalog.course?.modules[0]?.lessons[0];
  if (!lesson) throw new Error('The fixture catalog has no lesson.');
  return lesson;
}

export function moduleOf(catalog: RawCatalog): RawModule {
  const first = catalog.course?.modules[0];
  if (!first) throw new Error('The fixture catalog has no module.');
  return first;
}

/** The first step of a given type, narrowed, so a test can change one typed field. */
export function stepOf<T extends Step['type']>(
  lesson: RawLesson,
  type: T,
): Extract<Step, { type: T }> {
  const step = lesson.data.steps.find((s): s is Extract<Step, { type: T }> => s.type === type);
  if (!step) throw new Error(`The fixture lesson has no ${type} step.`);
  return step;
}
