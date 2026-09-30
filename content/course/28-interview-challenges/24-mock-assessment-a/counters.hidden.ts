import { scoreboard } from './counters.solution';

test('one counter, one point', () => {
  expect(scoreboard(1, [1])).toEqual([1]);
});

test('one counter, reset only', () => {
  expect(scoreboard(1, [2])).toEqual([0]);
});

test('a reset before any point changes nothing', () => {
  expect(scoreboard(3, [4, 4, 2])).toEqual([0, 1, 0]);
});

test('a reset as the last operation', () => {
  expect(scoreboard(3, [1, 2, 2, 4])).toEqual([2, 2, 2]);
});

test('two resets in a row', () => {
  expect(scoreboard(2, [1, 3, 3, 2])).toEqual([1, 2]);
});

test('points after a reset build on the new level', () => {
  expect(scoreboard(3, [1, 1, 4, 1, 1, 3])).toEqual([4, 2, 3]);
});

test('a counter untouched after a reset is still raised', () => {
  expect(scoreboard(4, [2, 2, 2, 5, 1])).toEqual([4, 3, 3, 3]);
});

test('the maximum keeps growing across several resets', () => {
  expect(scoreboard(2, [1, 3, 1, 3, 1, 3])).toEqual([3, 3]);
});

test('every counter gets one point', () => {
  expect(scoreboard(5, [5, 4, 3, 2, 1])).toEqual([1, 1, 1, 1, 1]);
});

test('the caller gets a fresh array of N counters', () => {
  const result = scoreboard(3, [1]);
  expect(result).toHaveLength(3);
  expect(result).toEqual([1, 0, 0]);
});
