import { largestSeason } from './seasons.solution';

test('one episode', () => {
  expect(largestSeason(1, [40])).toBe(40);
  expect(largestSeason(5, [40])).toBe(40);
});

test('more seasons than episodes', () => {
  expect(largestSeason(10, [30, 50, 20])).toBe(50);
});

test('all episodes zero minutes long', () => {
  expect(largestSeason(2, [0, 0, 0, 0])).toBe(0);
});

test('all equal', () => {
  expect(largestSeason(2, [10, 10, 10, 10])).toBe(20);
  expect(largestSeason(3, [10, 10, 10, 10])).toBe(20);
});

test('sorted ascending', () => {
  expect(largestSeason(2, [1, 2, 3, 4, 5])).toBe(9);
});

test('sorted descending', () => {
  expect(largestSeason(2, [5, 4, 3, 2, 1])).toBe(9);
});

test('one long episode dominates', () => {
  expect(largestSeason(2, [1, 1, 100, 1, 1])).toBe(102);
  expect(largestSeason(3, [1, 1, 100, 1, 1])).toBe(100);
});

test('extremes of the value range', () => {
  expect(largestSeason(2, [10_000, 10_000, 10_000])).toBe(20_000);
  expect(largestSeason(1, [0, 10_000, 0])).toBe(10_000);
});

test('zeros between long episodes', () => {
  expect(largestSeason(2, [7, 0, 0, 7, 0, 7])).toBe(14);
});

test('K equal to N gives the longest episode', () => {
  expect(largestSeason(4, [3, 9, 2, 6])).toBe(9);
});
