import { describe, expect, it } from 'vitest';
import { editorRequest, parseReviewBlock } from '@/core/scout';

/* The Editor: feedback on the learner's own work (docs/SCOUT-ROLES.md, section 7). */

const json = (value: unknown) => JSON.stringify(value);

describe('a review', () => {
  const review = {
    notes: [
      {
        tag: 'keep',
        quote: 'const seen = new Set()',
        note: 'A set makes the lookup constant time.',
      },
      {
        tag: 'fix',
        quote: 'for (let i = 0; i <= xs.length; i++)',
        note: 'The last turn reads past the end.',
      },
      { tag: 'missing', note: 'Nothing handles an empty list.' },
    ],
    next: 'Fix the loop bound, then run the tests again.',
  };

  it('reads up to three tagged notes and one next step', () => {
    const parsed = parseReviewBlock(json(review));
    expect(parsed?.notes.map((n) => n.tag)).toEqual(['keep', 'fix', 'missing']);
    expect(parsed?.next).toMatch(/loop bound/);
  });

  it('refuses no notes, more than three, an unknown tag and broken JSON', () => {
    expect(parseReviewBlock(json({ ...review, notes: [] }))).toBeNull();
    expect(
      parseReviewBlock(json({ ...review, notes: [...review.notes, review.notes[0]] })),
    ).toBeNull();
    expect(
      parseReviewBlock(json({ ...review, notes: [{ tag: 'great', note: 'Well done.' }] })),
    ).toBeNull();
    expect(parseReviewBlock('{')).toBeNull();
  });
});

describe('asking for a review of code', () => {
  it('sends the task, the code and the run, and asks for the review block', () => {
    const text = editorRequest({
      task: 'Return the first repeated item.',
      work: 'function first(xs) {}',
      language: 'js',
      run: '2 of 3 tests fail.',
    });
    expect(text).toContain('Return the first repeated item.');
    expect(text).toContain('```js\nfunction first(xs) {}\n```');
    expect(text).toContain('My last run:\n> 2 of 3 tests fail.');
    expect(text).toMatch(/review my code/i);
    expect(text).not.toContain('earlier version');
  });

  it('sends the earlier version when the learner revised, and asks what changed', () => {
    const text = editorRequest({
      task: 'Sum.',
      work: 'new',
      language: 'python',
      previous: 'old',
    });
    expect(text).toContain('My earlier version:\n```python\nold\n```');
    expect(text).toMatch(/say first what changed/i);
  });
});
