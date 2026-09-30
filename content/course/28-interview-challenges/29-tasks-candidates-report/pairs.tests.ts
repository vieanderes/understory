import { largestK } from './pairs.solution';

test('the examples from the task', () => {
  expect(largestK([3, 2, -2, 5, -3])).toBe(3);
  expect(largestK([1, 2, 3, -4])).toBe(0);
});

test('zero is not a K, since K must be above 0', () => {
  expect(largestK([0, 0])).toBe(0);
  expect(largestK([0, 4, -4])).toBe(4);
});

test('duplicates count once', () => {
  expect(largestK([2, 2, -2, -2])).toBe(2);
});

test('several pairs give the largest', () => {
  expect(largestK([1, -1, 7, -7, 4, -4])).toBe(7);
});

test('a negative without its positive is not a pair', () => {
  expect(largestK([-5, -6, 6])).toBe(6);
  expect(largestK([-9, 1])).toBe(0);
});

test('one number and an empty list give 0', () => {
  expect(largestK([5])).toBe(0);
  expect(largestK([])).toBe(0);
});

test('performance: 100,000 numbers with the pair at the far ends', () => {
  const values: number[] = [];
  for (let i = 1; i <= 100000; i++) values.push(i);
  values[0] = -100000;
  expect(largestK(values)).toBe(100000);
});
