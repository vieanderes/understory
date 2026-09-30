import { isBalanced } from './balanced.solution';

test('example from the task', () => {
  expect(isBalanced('{"ids": [1, (2)]}')).toBe(true);
  expect(isBalanced('(]')).toBe(false);
});

test('an empty string is balanced', () => {
  expect(isBalanced('')).toBe(true);
});

test('text with no brackets is balanced', () => {
  expect(isBalanced('port = 8080')).toBe(true);
});

test('an opener that never closes', () => {
  expect(isBalanced('(()')).toBe(false);
});

test('a closer with nothing open', () => {
  expect(isBalanced('())')).toBe(false);
  expect(isBalanced(')(')).toBe(false);
});

test('pairs that cross', () => {
  expect(isBalanced('([)]')).toBe(false);
});

test('performance: 100,000 nested pairs', () => {
  const deep = '([{'.repeat(33_334) + '}])'.repeat(33_334);
  expect(isBalanced(deep)).toBe(true);
  expect(isBalanced(deep.slice(0, -1))).toBe(false);
});
