import { nextAction, type PrSnapshot } from './watch.solution';

const base: PrSnapshot = {
  ci: 'green',
  approved: true,
  newComments: 0,
  runsSoFar: 3,
  maxRuns: 12,
  sameFailureCount: 0,
  headCommit: 'c41',
  proofCommit: 'c41',
};

test('approved, green and proven on the head commit means done', () => {
  expect(nextAction(base)).toBe('stop: done');
});

test('proof from an older commit is refreshed before saying done', () => {
  expect(nextAction({ ...base, proofCommit: 'b07' })).toBe('refresh-proof');
});

test('a forbidden action is refused, even on an approved green PR', () => {
  expect(nextAction({ ...base, requested: 'merge' })).toBe('refuse: merge');
  expect(nextAction({ ...base, ci: 'red', requested: 'loosen-check' })).toBe('refuse: loosen-check');
});

test('a wider change waits for a person', () => {
  expect(nextAction({ ...base, requested: 'change-dependency' })).toBe('ask: change-dependency');
  expect(nextAction({ ...base, runsSoFar: 12, requested: 'merge' })).toBe('refuse: merge');
  expect(nextAction({ ...base, requested: 'reply-to-comments' })).toBe('stop: done');
});

test('the budget and a repeated failure hand the PR to a person', () => {
  expect(nextAction({ ...base, ci: 'red', runsSoFar: 12 })).toBe('hand-off: out of runs');
  expect(nextAction({ ...base, ci: 'red', sameFailureCount: 2 })).toBe('hand-off: stuck');
});

test('red CI is fixed, pending CI is waited for', () => {
  expect(nextAction({ ...base, ci: 'red', sameFailureCount: 1 })).toBe('fix-ci');
  expect(nextAction({ ...base, ci: 'red', newComments: 3 })).toBe('fix-ci');
  expect(nextAction({ ...base, ci: 'pending', newComments: 2 })).toBe('wait');
});

test('new comments come before proof, and an unapproved PR gets a status', () => {
  expect(nextAction({ ...base, newComments: 1, proofCommit: 'b07' })).toBe('answer-comments');
  expect(nextAction({ ...base, approved: false })).toBe('post-status');
});
