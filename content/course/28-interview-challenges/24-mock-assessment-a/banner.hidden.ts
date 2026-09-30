import { largestBanner } from './banner.solution';

test('one building of height zero', () => {
  expect(largestBanner([0])).toBe(0);
});

test('all equal', () => {
  expect(largestBanner([3, 3, 3, 3])).toBe(12);
});

test('all zero', () => {
  expect(largestBanner([0, 0, 0])).toBe(0);
});

test('sorted ascending', () => {
  expect(largestBanner([1, 2, 3, 4, 5])).toBe(9);
});

test('sorted descending', () => {
  expect(largestBanner([5, 4, 3, 2, 1])).toBe(9);
});

test('a zero splits the skyline', () => {
  expect(largestBanner([4, 4, 0, 3, 3, 3])).toBe(9);
});

test('duplicates next to a dip', () => {
  expect(largestBanner([2, 2, 1, 2, 2])).toBe(5);
});

test('one tall building wins', () => {
  expect(largestBanner([1, 1_000_000_000, 1])).toBe(1_000_000_000);
});

test('the maximum height across many buildings stays exact', () => {
  const H = new Array<number>(1000).fill(1_000_000_000);
  expect(largestBanner(H)).toBe(1_000_000_000_000);
});

test('a valley shape', () => {
  expect(largestBanner([6, 2, 5, 4, 5, 1, 6])).toBe(12);
});
