import { daysToWait } from './solution';

test('example from the task', () => {
  expect(daysToWait([13, 14, 12, 11, 15])).toEqual([1, 3, 2, 1, 0]);
});

test('a day with no warmer day after it waits 0', () => {
  expect(daysToWait([20, 18, 16])).toEqual([0, 0, 0]);
});

test('an equal temperature is not warmer', () => {
  expect(daysToWait([15, 15, 16])).toEqual([2, 1, 0]);
});

test('no days give an empty list', () => {
  expect(daysToWait([])).toEqual([]);
});

test('one day waits 0', () => {
  expect(daysToWait([9])).toEqual([0]);
});

test('performance: 100,000 falling days, then one warm day', () => {
  const n = 100000;
  const temps: number[] = [];
  for (let i = 0; i < n; i++) temps.push(n - i);
  temps.push(n + 1);
  const wait = daysToWait(temps);
  expect(wait[0]).toBe(n);
  expect(wait[n - 1]).toBe(1);
  expect(wait[n]).toBe(0);
});

test('a flat week never gets warmer', () => {
  expect(daysToWait([7, 7, 7, 7])).toEqual([0, 0, 0, 0]);
});
