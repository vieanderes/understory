import { describe, expect, it } from 'vitest';
import { readabilityOf, READABILITY } from '@/core/content/readability';
import type { Lesson } from '@/core/content/schema';

const choice = (text: string, feedback: string, correct = false) => ({
  text,
  feedback,
  ...(correct ? { correct: true } : {}),
});

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'demo.lesson',
    title: 'Demo',
    objective: 'Do a thing.',
    level: 'essential',
    minutes: 8,
    concepts: ['demo.concept'],
    prerequisites: [],
    opening: { text: 'You will learn one thing. It helps.' },
    steps: [
      { type: 'prose', id: 'one', body: 'A short and friendly point about one idea.' },
      {
        type: 'multiple-choice',
        id: 'ask',
        concept: 'demo.concept',
        difficulty: 1,
        question: 'Which one is right?',
        choices: [choice('This one', 'Yes, because it is.', true), choice('That one', 'Close, but no.')],
      },
      {
        type: 'bug-hunt',
        id: 'fix',
        concept: 'demo.concept',
        difficulty: 2,
        code: 'let total = 0;\ntotal = total + price;',
        language: 'js',
        prompt: 'Which line has the bug?',
        lines: [2],
        reasons: [choice('It uses an undefined name', 'Yes, nothing defines it.', true), choice('It adds', 'Adding is fine.')],
      },
    ],
    recap: ['You can do one thing.', 'You can do another.', 'You can do a third.'],
    recall: [],
    references: [],
    ...overrides,
  } as Lesson;
}

const rules = (l: Lesson) => readabilityOf(l, 'lesson.yaml').map((issue) => issue.rule);

describe('readabilityOf', () => {
  it('finds nothing in a lesson that follows the guide', () => {
    expect(readabilityOf(lesson(), 'lesson.yaml')).toEqual([]);
  });

  it('flags a prose step over the word limit', () => {
    const body = Array.from({ length: READABILITY.proseWords + 1 }, () => 'word').join(' ') + '.';
    expect(rules(lesson({ steps: [{ type: 'prose', id: 'long', body }] }))).toContain(
      'readability-prose-long',
    );
  });

  it('flags a sentence over the ceiling, wherever the learner reads it', () => {
    const sentence = Array.from({ length: READABILITY.sentenceWords + 1 }, () => 'word').join(' ') + '.';
    expect(rules(lesson({ opening: { text: sentence } }))).toContain(
      'readability-sentence-long',
    );
  });

  it('flags a double question', () => {
    const l = lesson();
    (l.steps[1] as { question: string }).question = 'Which feels ready on Monday, and which scores higher?';
    expect(rules(l)).toContain('readability-double-question');
  });

  it('flags long choices and long feedback, with a tighter limit for the right answer', () => {
    const l = lesson();
    const step = l.steps[1] as { choices: ReturnType<typeof choice>[] };
    step.choices[0] = choice('one two three four five six seven eight nine ten eleven', 'a b c d e f g h i j k l m n o p.', true);
    const found = rules(l);
    expect(found).toContain('readability-choice-long');
    expect(found).toContain('readability-feedback-long');
  });

  it('holds a verify follow-up to the question, choice and feedback limits', () => {
    const l = lesson();
    const long = Array.from({ length: READABILITY.questionWords + 1 }, () => 'word').join(' ') + '?';
    Object.assign(l.steps[2] as object, {
      verify: {
        question: long,
        choices: [
          choice('one two three four five six seven eight nine ten eleven', 'Yes.', true),
          choice('No', 'a b c d e f g h i j k l m n o p q r s t u v w x y z.'),
        ],
      },
    });
    const found = readabilityOf(l, 'lesson.yaml');
    const at = (rule: string) => found.filter((issue) => issue.rule === rule).map((i) => i.message);
    expect(at('readability-question-long')[0]).toContain('verify.question');
    expect(at('readability-choice-long')[0]).toContain('verify.choices[0].text');
    expect(at('readability-feedback-long')[0]).toContain('verify.choices[1].feedback');
  });

  it('finds nothing in a short verify follow-up', () => {
    const l = lesson();
    Object.assign(l.steps[2] as object, {
      verify: {
        question: 'Which test proves the fix?',
        choices: [choice('A price of zero', 'Yes: it shows the gap.', true), choice('No test', 'A fix needs proof.')],
      },
    });
    expect(readabilityOf(l, 'lesson.yaml')).toEqual([]);
  });

  it('flags the feedback template once it repeats past the allowance', () => {
    const l = lesson();
    const step = l.steps[1] as { choices: ReturnType<typeof choice>[] };
    step.choices = [
      choice('A', 'Right.', true),
      choice('B', 'You predicted that B holds.'),
      choice('C', 'You predicted that C holds.'),
      choice('D', 'You predicted that D holds.'),
    ];
    expect(rules(l)).toContain('readability-template');
  });

  it('flags research citations inside a step', () => {
    expect(
      rules(lesson({ steps: [{ type: 'prose', id: 'cite', body: 'Cepeda and colleagues reviewed 317 experiments in 2006.' }] })),
    ).toContain('readability-citation');
  });

  it('flags plain sentences put in the code pane', () => {
    const l = lesson();
    Object.assign(l.steps[1] as object, {
      language: 'text',
      code: 'Both groups train for forty minutes on Monday.\nGroup A reads the rules four times over.',
    });
    expect(rules(l)).toContain('readability-prose-in-code');
  });

  it('does not mistake real code or data for prose', () => {
    const l = lesson();
    Object.assign(l.steps[1] as object, { language: 'js', code: 'const total = price * quantity;\nconsole.log(total);' });
    expect(rules(l)).not.toContain('readability-prose-in-code');
  });

  it('flags a lesson with too many steps or minutes', () => {
    const steps = Array.from({ length: READABILITY.maxSteps + 1 }, (_, i) => ({
      type: 'prose' as const,
      id: `s${i}`,
      body: 'One idea.',
    }));
    expect(rules(lesson({ steps, minutes: READABILITY.maxMinutes + 5 }))).toContain('readability-lesson-long');
  });

  it('asks for a three-line recap and reads its lines like any other text', () => {
    expect(rules(lesson({ recap: undefined }))).toContain('readability-recap-missing');
    const recap = ['You can name a thing.', 'You can change it.', 'You can show it.'];
    expect(rules(lesson({ recap }))).not.toContain('readability-recap-missing');
    const long = [
      'You can now do this one thing and then another thing and then a third thing after the first two things.',
      ...recap.slice(1),
    ];
    expect(rules(lesson({ recap: long }))).toContain('readability-sentence-long');
  });

  it('reads a figure caption like any other sentence', () => {
    const caption =
      'This caption goes on and on about the figure with far more words than any short caption on a small figure should ever need.';
    const steps = [
      { type: 'prose' as const, id: 'one', body: 'One idea.', figure: { id: 'event-loop-queues' as const, caption } },
    ];
    expect(rules(lesson({ steps }))).toContain('readability-sentence-long');
  });

  it('allows one exclamation mark and flags the second', () => {
    const one = lesson({ opening: { text: 'Here we go!' } });
    expect(rules(one)).not.toContain('readability-exclamation');
    const two = lesson({ opening: { text: 'Here we go! Off we go!' } });
    expect(rules(two)).toContain('readability-exclamation');
  });

  it('holds a playground prompt to one short task and its check labels to choice length', () => {
    const long = Array.from({ length: READABILITY.taskWords + 1 }, () => 'word').join(' ');
    const rules = readabilityOf(
      lesson({
        steps: [
          {
            type: 'playground',
            id: 'play',
            prompt: `${long}.`,
            html: '<h1>Hi</h1>',
            checks: [{ label: 'one two three four five six seven eight nine ten eleven', selector: 'h1' }],
            hints: ['Look at et al. 2020 for this.'],
          },
        ],
      }),
      'p',
    ).map((issue) => issue.rule);
    expect(rules).toContain('readability-task-long');
    expect(rules).toContain('readability-check-long');
    expect(rules).toContain('readability-citation');
  });

  it('holds a sql prompt to one short task and reads its hints', () => {
    const long = Array.from({ length: READABILITY.taskWords + 1 }, () => 'word').join(' ');
    const issues = readabilityOf(
      lesson({
        steps: [
          {
            type: 'sql',
            id: 'query',
            prompt: `${long}.`,
            setup: 'create table t (a int);',
            hints: ['Look at et al. 2020 for this.'],
          },
        ],
      }),
      'p',
    );
    expect(issues.map((issue) => issue.rule)).toContain('readability-task-long');
    expect(issues.find((issue) => issue.rule === 'readability-citation')?.where).toBe('query');
    const short = readabilityOf(
      lesson({ steps: [{ type: 'sql', id: 'query', prompt: 'Show every order.' }] }),
      'p',
    );
    expect(short.map((issue) => issue.rule)).not.toContain('readability-task-long');
  });

  describe('practise coding, not arithmetic (rules 39 to 41)', () => {
    const mc = (id: string) => ({
      type: 'multiple-choice' as const,
      id,
      concept: 'demo.concept',
      difficulty: 1,
      question: 'Which one?',
      choices: [choice('This', 'Yes.', true), choice('That', 'No.')],
    });
    const predict = (id: string) => ({ ...mc(id), type: 'predict-output' as const, code: 'console.log(1);', language: 'js' as const });
    const bugHunt = (id: string) => ({
      type: 'bug-hunt' as const,
      id,
      concept: 'demo.concept',
      difficulty: 2,
      code: 'console.log(1);',
      language: 'js' as const,
      prompt: 'Find the bug.',
      lines: [1],
      reasons: [choice('This', 'Yes.', true), choice('That', 'No.')],
    });
    const fill = (id: string, language: 'js' | 'text') => ({
      type: 'fill-blank' as const,
      id,
      concept: 'demo.concept',
      difficulty: 1,
      prompt: 'Fill it in.',
      template: 'let {{1}} = 1;',
      language,
      blanks: [{ key: '1', answer: 'x' }],
      bank: ['x', 'y'],
    });
    const playground = (id: string, checked: boolean) => ({
      type: 'playground' as const,
      id,
      prompt: 'Change it.',
      html: '<h1>Hi</h1>',
      ...(checked
        ? { concept: 'demo.concept', difficulty: 1, checks: [{ label: 'One heading', selector: 'h1' }], solution: { html: '<h1>Yo</h1>' } }
        : {}),
    });
    const trace = (rows: number) => ({
      type: 'trace-table' as const,
      id: 'trace',
      concept: 'demo.concept',
      difficulty: 2,
      code: 'let a = 1;',
      language: 'js' as const,
      prompt: 'Fill in the table.',
      columns: ['a'],
      rows: Array.from({ length: rows }, () => ({ line: 1, values: ['1'] })),
    });
    const at = (steps: unknown[]) => rules(lesson({ steps: steps as Lesson['steps'] }));

    it('allows two predict-output steps and flags the third', () => {
      expect(at([predict('p1'), predict('p2'), bugHunt('b1'), bugHunt('b2')])).not.toContain('readability-predict-many');
      expect(at([predict('p1'), predict('p2'), predict('p3'), bugHunt('b1'), bugHunt('b2'), bugHunt('b3')])).toContain(
        'readability-predict-many',
      );
    });

    it('flags a trace table with more than four rows', () => {
      expect(at([trace(READABILITY.traceRows), bugHunt('b1')])).not.toContain('readability-trace-long');
      expect(at([trace(READABILITY.traceRows + 1), bugHunt('b1')])).toContain('readability-trace-long');
    });

    it('flags a lesson where fewer than half the scored steps are active', () => {
      expect(at([mc('m1'), mc('m2'), bugHunt('b1')])).toContain('readability-passive');
      expect(at([mc('m1'), bugHunt('b1')])).not.toContain('readability-passive');
    });

    it('counts a checked playground and a fill-blank of real code as active, and skips prose and unchecked playgrounds', () => {
      expect(at([mc('m1'), mc('m2'), playground('p1', true), fill('f1', 'js')])).not.toContain('readability-passive');
      expect(at([mc('m1'), mc('m2'), fill('f1', 'text'), playground('p2', false)])).toContain('readability-passive');
      expect(at([mc('m1'), playground('p1', true), playground('p2', false), { type: 'prose', id: 'x', body: 'Hi.' }])).not.toContain(
        'readability-passive',
      );
    });

    it('judges a lab or incident by its fallback step', () => {
      const lab = (fallback: unknown) => ({ type: 'lab' as const, id: 'lab', concept: 'demo.concept', difficulty: 2, lab: 'event-loop', intro: 'Try it.', fallback });
      expect(at([mc('m1'), lab(bugHunt('fb'))])).not.toContain('readability-passive');
      expect(at([mc('m1'), lab(mc('fb'))])).toContain('readability-passive');
    });
  });

  it('reports every issue as a warning with the step it came from', () => {
    const l = lesson();
    (l.steps[1] as { question: string }).question = 'Which one, and which other?';
    const [issue] = readabilityOf(l, 'lesson.yaml');
    expect(issue).toMatchObject({ severity: 'warning', path: 'lesson.yaml', where: 'ask' });
  });
});
