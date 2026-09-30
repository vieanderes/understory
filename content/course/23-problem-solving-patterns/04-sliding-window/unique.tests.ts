import { longestUnique } from './unique.solution';

test('example from the task', () => {
  expect(longestUnique([3, 1, 4, 1, 5, 9])).toBe(4);
});

test('no songs', () => {
  expect(longestUnique([])).toBe(0);
});

test('the same song over and over', () => {
  expect(longestUnique([7, 7, 7])).toBe(1);
});

test('no repeats at all', () => {
  expect(longestUnique([1, 2, 3, 4])).toBe(4);
});

test('a repeat far back in the window', () => {
  expect(longestUnique([1, 2, 3, 1, 4, 5])).toBe(5);
});

test('the best run is at the end', () => {
  expect(longestUnique([2, 2, 1, 3, 4])).toBe(4);
});

test('performance: 200,000 songs', () => {
  const songs = Array.from({ length: 200_000 }, (_, i) => i % 1000);
  expect(longestUnique(songs)).toBe(1000);
});
