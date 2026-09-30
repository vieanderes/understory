import { describe, expect, it } from 'vitest';
import type {
  AiReviewStep,
  BugHuntStep,
  ExplainBackStep,
  FillBlankStep,
  LabStep,
  MultipleChoiceStep,
  ParsonsStep,
  PredictStep,
  TraceTableStep,
  CodeChallengeStep,
} from '@/core/content/schema';
import { gradePlayground, gradeRun, gradeStep, normaliseCell } from '@/core/grading/grade';

const predictStep: PredictStep = {
  type: 'predict-output',
  id: 'predict-total',
  concept: 'js.closures',
  difficulty: 2,
  code: 'console.log(1)',
  language: 'js',
  question: 'What does this log?',
  choices: [
    { text: '1', correct: true, feedback: 'Right.' },
    { text: '2', feedback: 'Wrong: it logs the literal 1.' },
  ],
};

describe('gradeStep: predict-output / multiple-choice / lab (shared choice logic)', () => {
  it('is correct when the picked choice is marked correct', () => {
    const grade = gradeStep(predictStep, { type: 'predict-output', choiceIndex: 0 });
    expect(grade).toEqual({
      correct: true,
      score: 1,
      feedback: [{ kind: 'choice', message: 'Right.' }],
    });
  });

  it('is incorrect, with the misconception feedback, when the wrong choice is picked', () => {
    const grade = gradeStep(predictStep, { type: 'predict-output', choiceIndex: 1 });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.feedback[0]?.message).toMatch(/literal 1/);
  });

  it('grades multiple-choice the same way', () => {
    const mc: MultipleChoiceStep = {
      type: 'multiple-choice',
      id: 'mc-1',
      concept: 'js.closures',
      difficulty: 1,
      question: 'Which keyword declares a block-scoped variable?',
      choices: [
        { text: 'var', feedback: 'var is function-scoped.' },
        { text: 'let', correct: true, feedback: 'Right.' },
      ],
    };
    expect(gradeStep(mc, { type: 'multiple-choice', choiceIndex: 1 }).correct).toBe(true);
  });

  it('grades a lab checkpoint the same way', () => {
    const lab: LabStep = {
      type: 'lab',
      id: 'lab-1',
      concept: 'js.event-loop',
      lab: 'event-loop-stepper',
      intro: 'Step through the queue.',
      checkpoint: {
        question: 'Which runs first?',
        difficulty: 2,
        choices: [
          { text: 'microtask', correct: true, feedback: 'Right.' },
          { text: 'macrotask', feedback: 'Macrotasks run after all microtasks.' },
        ],
      },
      fallback: predictStep,
    };
    expect(gradeStep(lab, { type: 'lab', choiceIndex: 0 }).correct).toBe(true);
  });

  it('is not correct when a lab checkpoint has no checkpoint block', () => {
    const lab: LabStep = {
      type: 'lab',
      id: 'lab-2',
      concept: 'js.event-loop',
      lab: 'event-loop-stepper',
      intro: 'Step through the queue.',
      fallback: predictStep,
    };
    expect(gradeStep(lab, { type: 'lab', choiceIndex: 0 })).toEqual({
      correct: false,
      score: 0,
      feedback: [],
    });
  });

  it('throws when the answer type does not match the step type', () => {
    expect(() => gradeStep(predictStep, { type: 'multiple-choice', choiceIndex: 0 })).toThrow();
  });
});

describe('normaliseCell', () => {
  it('trims whitespace', () => {
    expect(normaliseCell('  5  ')).toBe('5');
  });

  it('normalises smart quotes to straight quotes', () => {
    expect(normaliseCell('“hello”')).toBe('"hello"');
    expect(normaliseCell('it’s')).toBe("it's");
  });
});

describe('gradeStep: trace-table', () => {
  const step: TraceTableStep = {
    type: 'trace-table',
    id: 'trace-1',
    concept: 'js.loops',
    difficulty: 2,
    code: 'let total = 0;\nfor (...) total += i;',
    language: 'js',
    prompt: 'Fill in total after each line.',
    columns: ['total'],
    rows: [
      { line: 1, values: ['0'], given: true },
      { line: 2, values: ['1'] },
      { line: 3, values: ['3'] },
    ],
  };

  it('scores per cell, ignoring given rows, comparing trimmed and quote-normalised values', () => {
    const grade = gradeStep(step, { type: 'trace-table', cells: [[], ['1'], [' 3 ']] });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
  });

  it('gives partial credit for some correct cells', () => {
    const grade = gradeStep(step, { type: 'trace-table', cells: [[], ['1'], ['9']] });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBeCloseTo(0.5);
  });

  it('treats a missing cell as incorrect, not a crash', () => {
    const grade = gradeStep(step, { type: 'trace-table', cells: [[]] });
    expect(grade.score).toBeCloseTo(0);
  });
});

describe('gradeStep: fill-blank', () => {
  const step: FillBlankStep = {
    type: 'fill-blank',
    id: 'fill-1',
    concept: 'js.arrays',
    difficulty: 1,
    prompt: 'Complete the map call.',
    template: 'arr.{{1}}(x => x * 2)',
    language: 'js',
    blanks: [{ key: '1', answer: 'map', accept: ['Map'] }],
    bank: ['map', 'filter'],
  };

  it('accepts the primary answer', () => {
    expect(gradeStep(step, { type: 'fill-blank', values: { '1': 'map' } }).correct).toBe(true);
  });

  it('accepts a listed alternative', () => {
    expect(gradeStep(step, { type: 'fill-blank', values: { '1': 'Map' } }).correct).toBe(true);
  });

  it('is incorrect for an unlisted answer', () => {
    const grade = gradeStep(step, { type: 'fill-blank', values: { '1': 'filter' } });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
  });

  it("trims the learner's answer before comparing", () => {
    expect(gradeStep(step, { type: 'fill-blank', values: { '1': '  map  ' } }).correct).toBe(true);
  });
});

describe('gradeStep: parsons', () => {
  const step: ParsonsStep = {
    type: 'parsons',
    id: 'parsons-1',
    concept: 'js.functions',
    difficulty: 2,
    prompt: 'Arrange the function.',
    language: 'js',
    blocks: [
      { id: 'a', code: 'function total(items) {' },
      { id: 'b', code: 'return items.reduce((s, i) => s + i, 0);' },
      { id: 'c', code: '}' },
    ],
    distractors: [
      {
        id: 'd',
        code: 'return items.length;',
        feedback: 'That counts items, it does not sum them.',
      },
    ],
  };

  it('is fully correct in the right order with no distractor used', () => {
    const grade = gradeStep(step, { type: 'parsons', order: ['a', 'b', 'c'] });
    expect(grade).toMatchObject({ correct: true, score: 1 });
  });

  it('gives partial credit for a partially correct order', () => {
    const grade = gradeStep(step, { type: 'parsons', order: ['a', 'c', 'b'] });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBeCloseTo(1 / 3);
  });

  it("surfaces the distractor's own feedback when it is used", () => {
    const grade = gradeStep(step, { type: 'parsons', order: ['a', 'd', 'b', 'c'] });
    expect(grade.correct).toBe(false);
    expect(grade.feedback[0]?.message).toMatch(/does not sum/);
  });

  it('checks indentation when checkIndent is set', () => {
    const indentStep: ParsonsStep = {
      ...step,
      checkIndent: true,
      blocks: step.blocks.map((b) => (b.id === 'b' ? { ...b, indent: 1 } : b)),
    };
    const wrongIndent = gradeStep(indentStep, {
      type: 'parsons',
      order: ['a', 'b', 'c'],
      indents: { a: 0, b: 0, c: 0 },
    });
    expect(wrongIndent.correct).toBe(false);

    const rightIndent = gradeStep(indentStep, {
      type: 'parsons',
      order: ['a', 'b', 'c'],
      indents: { a: 0, b: 1, c: 0 },
    });
    expect(rightIndent.correct).toBe(true);
  });

  it('does not check indentation when checkIndent is set but the learner gave none', () => {
    const indentStep: ParsonsStep = {
      ...step,
      checkIndent: true,
      blocks: step.blocks.map((b) => (b.id === 'b' ? { ...b, indent: 1 } : b)),
    };
    const grade = gradeStep(indentStep, { type: 'parsons', order: ['a', 'b', 'c'] });
    expect(grade.correct).toBe(true);
  });

  it('ignores indentation entirely when checkIndent is not set', () => {
    const grade = gradeStep(step, {
      type: 'parsons',
      order: ['a', 'b', 'c'],
      indents: { a: 5, b: 5, c: 5 },
    });
    expect(grade.correct).toBe(true);
  });
});

describe('gradeStep: bug-hunt / ai-review', () => {
  const bugHunt: BugHuntStep = {
    type: 'bug-hunt',
    id: 'bug-1',
    concept: 'js.async',
    difficulty: 3,
    code: 'await Promise.all(items.map(fetchOne));',
    language: 'js',
    prompt: 'Find the bug.',
    lines: [1],
    reasons: [
      { text: 'Runs sequentially', feedback: 'Not quite: map does not await in sequence.' },
      { text: 'Missing await', correct: true, feedback: 'Right: the outer await is missing.' },
    ],
  };

  it('is fully correct with the right line and the right reason', () => {
    const grade = gradeStep(bugHunt, { type: 'bug-hunt', lines: [1], reasonIndex: 1 });
    expect(grade).toEqual({
      correct: true,
      score: 1,
      feedback: [{ kind: 'reason', message: 'Right: the outer await is missing.' }],
    });
  });

  it('gives 0.5 credit for the right line and the wrong reason', () => {
    const grade = gradeStep(bugHunt, { type: 'bug-hunt', lines: [1], reasonIndex: 0 });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0.5);
  });

  it('gives 0 for the wrong line, regardless of the reason', () => {
    const grade = gradeStep(bugHunt, { type: 'bug-hunt', lines: [2], reasonIndex: 1 });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
  });

  it('handles an out-of-range reasonIndex without crashing (no feedback, not correct)', () => {
    const grade = gradeStep(bugHunt, { type: 'bug-hunt', lines: [1], reasonIndex: 99 });
    expect(grade).toEqual({ correct: false, score: 0.5, feedback: [] });
  });

  it('grades ai-review with the same rule', () => {
    const aiReview: AiReviewStep = {
      ...bugHunt,
      type: 'ai-review',
      request: 'Fetch all the items.',
      flawClass: 'race',
    };
    expect(gradeStep(aiReview, { type: 'ai-review', lines: [1], reasonIndex: 1 }).correct).toBe(
      true,
    );
  });
});

describe('gradeStep: explain-back', () => {
  const step: ExplainBackStep = {
    type: 'explain-back',
    id: 'explain-1',
    concept: 'js.event-loop',
    difficulty: 3,
    prompt: 'Why does this log order surprise people?',
    rubric: ['Names microtasks', 'Names macrotasks', 'Explains the ordering'],
    modelAnswer: 'Microtasks drain before the next macrotask runs.',
  };

  it('maps rubricHits 0..3 to score 0, 0.4, 0.7, 1', () => {
    expect(gradeStep(step, { type: 'explain-back', rubricHits: 0 }).score).toBe(0);
    expect(gradeStep(step, { type: 'explain-back', rubricHits: 1 }).score).toBe(0.4);
    expect(gradeStep(step, { type: 'explain-back', rubricHits: 2 }).score).toBe(0.7);
    expect(gradeStep(step, { type: 'explain-back', rubricHits: 3 }).score).toBe(1);
  });

  it('is only "correct" at the full rubric score', () => {
    expect(gradeStep(step, { type: 'explain-back', rubricHits: 2 }).correct).toBe(false);
    expect(gradeStep(step, { type: 'explain-back', rubricHits: 3 }).correct).toBe(true);
  });
});

describe('gradeRun', () => {
  const step: CodeChallengeStep = {
    type: 'code-challenge',
    id: 'challenge-1',
    concept: 'js.arrays',
    difficulty: 3,
    prompt: 'Write sum(items).',
    language: 'js',
    starter: 'starter.ts',
    solution: 'solution.ts',
    tests: 'tests.ts',
    hints: ['Look at reduce.', 'Start the accumulator at 0.', 'return items.reduce(...)'],
  };

  it('is correct when the run status is passed', () => {
    const grade = gradeRun(step, {
      status: 'passed',
      tests: [{ name: 'sums', passed: true }],
      logs: [],
    });
    expect(grade).toMatchObject({ correct: true, score: 1 });
  });

  it('gives partial credit for some passing tests', () => {
    const grade = gradeRun(step, {
      status: 'failed',
      tests: [
        { name: 'sums', passed: true },
        { name: 'handles empty', passed: false, message: 'Expected 0, got undefined' },
      ],
      logs: [],
    });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBeCloseTo(0.5);
    expect(grade.feedback[0]?.message).toMatch(/Expected 0/);
  });

  it('scores 0 for an error or timeout with no tests run', () => {
    const grade = gradeRun(step, { status: 'timeout', tests: [], logs: [] });
    expect(grade).toMatchObject({ correct: false, score: 0 });
  });
});

describe('gradePlayground', () => {
  const checks = [
    { label: 'One h1', selector: 'h1', count: 1 },
    { label: 'A paragraph', selector: 'p' },
  ];

  it('is correct when every check passes', () => {
    expect(gradePlayground(checks, [{ passed: true }, { passed: true }])).toEqual({
      correct: true,
      score: 1,
      feedback: [],
      detail: { passed: 2, total: 2 },
    });
  });

  it('gives partial credit and names each failed check with its reason', () => {
    const grade = gradePlayground(checks, [
      { passed: true },
      { passed: false, reason: 'Nothing matches "p" yet.' },
    ]);
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0.5);
    expect(grade.feedback).toEqual([
      { kind: 'check', message: 'A paragraph: Nothing matches "p" yet.' },
    ]);
  });

  it('counts a missing result as a fail, and a failure without a reason by its label', () => {
    const grade = gradePlayground(checks, [{ passed: false }]);
    expect(grade.score).toBe(0);
    expect(grade.feedback.map((f) => f.message)).toEqual(['One h1', 'A paragraph']);
  });

  it('scores nothing for a step without checks', () => {
    expect(gradePlayground([], [])).toMatchObject({ correct: false, score: 0 });
  });
});
