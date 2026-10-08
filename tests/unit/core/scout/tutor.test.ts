import { describe, expect, it } from 'vitest';
import { parseCheckBlock, runSummary, stuckQuestion, tutorEvidence } from '@/core/scout';

/* The Tutor: diagnose, then clear it up (docs/SCOUT-ROLES.md, section 6). */

const json = (value: unknown) => JSON.stringify(value);

describe('a check', () => {
  const check = {
    question: 'What does the inner function see?',
    options: [
      {
        text: 'The variable as it is when called',
        correct: true,
        feedback: 'Yes: it keeps the binding.',
      },
      {
        text: 'A copy made when it was defined',
        correct: false,
        feedback: 'It keeps the binding, not a copy.',
      },
    ],
  };

  it('reads a question with one right option and feedback for each', () => {
    expect(parseCheckBlock(json(check))?.options).toHaveLength(2);
  });

  it('refuses no right option, or two', () => {
    const none = check.options.map((o) => ({ ...o, correct: false }));
    const both = check.options.map((o) => ({ ...o, correct: true }));
    expect(parseCheckBlock(json({ ...check, options: none }))).toBeNull();
    expect(parseCheckBlock(json({ ...check, options: both }))).toBeNull();
  });

  it('refuses one option, more than four, and broken JSON', () => {
    expect(parseCheckBlock(json({ ...check, options: check.options.slice(0, 1) }))).toBeNull();
    const five = Array.from({ length: 5 }, (_, i) => ({ ...check.options[1]!, text: `${i}` }));
    expect(parseCheckBlock(json({ ...check, options: [check.options[0], ...five] }))).toBeNull();
    expect(parseCheckBlock('{')).toBeNull();
  });
});

describe('the question after a wrong answer', () => {
  it('carries the task, the pick and its feedback, and asks for a diagnosis', () => {
    const text = stuckQuestion({
      prompt: 'What does this print?',
      picked: '1 2 3',
      feedback: 'var is shared by every turn of the loop.',
    });
    expect(text).toContain('What does this print?');
    expect(text).toContain('I picked:\n> 1 2 3');
    expect(text).toContain('var is shared');
    expect(text).toMatch(/what I am getting wrong/i);
  });

  it('carries a failing run instead of a pick', () => {
    const text = stuckQuestion({ prompt: 'Write sum.', run: 'expected 6, got 5' });
    expect(text).toContain('My last run:\n> expected 6, got 5');
    expect(text).not.toContain('I picked');
  });
});

describe('what the Tutor knows of the learner', () => {
  it('names the state of the lesson’s concepts and the answers given wrongly with confidence', () => {
    const text = tutorEvidence({
      concepts: [
        { title: 'Closures', state: 'gap' },
        { title: 'Scope', state: 'practised' },
        { title: 'Hoisting', state: 'unseen' },
      ],
      misses: [{ prompt: 'What does this print?', confidence: 'certain' }],
    });
    expect(text).toContain('Closures: was solid, has slipped (a gap)');
    expect(text).toContain('Scope: practised');
    expect(text).not.toContain('Hoisting');
    expect(text).toContain('Answered wrongly while certain: What does this print?');
  });

  it('is empty when nothing is known', () => {
    expect(tutorEvidence({ concepts: [{ title: 'A', state: 'unseen' }], misses: [] })).toBe('');
  });
});

describe('a failing run in words', () => {
  it('names the failing tests with their messages, at most five, and the error', () => {
    const tests = Array.from({ length: 7 }, (_, i) => ({
      name: `case ${i}`,
      passed: i === 0,
      message: `expected ${i}`,
    }));
    const text = runSummary({
      status: 'failed',
      tests,
      logs: [],
      error: { name: 'TypeError', message: 'x is undefined', line: 3 },
    });
    expect(text).toContain('6 of 7 tests fail.');
    expect(text).toContain('- case 1: expected 1');
    expect(text).not.toContain('case 0');
    expect(text).not.toContain('case 6');
    expect(text).toContain('TypeError on line 3: x is undefined');
  });

  it('says when the run timed out', () => {
    expect(runSummary({ status: 'timeout', tests: [], logs: [] })).toContain('ran out of time');
  });
});
