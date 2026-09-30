import { longestRun } from './solution';

test('example from the task', () => {
  expect(longestRun([100, 4, 200, 1, 3, 2])).toBe(4);
});

test('an empty list has no run', () => {
  expect(longestRun([])).toBe(0);
});

test('a single number is a run of 1', () => {
  expect(longestRun([7])).toBe(1);
});

test('duplicates do not break or lengthen a run', () => {
  expect(longestRun([1, 2, 2, 3])).toBe(3);
});

test('negative numbers and zero count', () => {
  expect(longestRun([-2, 0, -1, 5, 1])).toBe(4);
});

test('performance: one run of 100,000 shuffled numbers', () => {
  const nums: number[] = [];
  for (let i = 0; i < 100000; i++) nums.push((i * 7919) % 100000);
  expect(longestRun(nums)).toBe(100000);
});
