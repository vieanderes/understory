import { rangeTotals } from './solution';

test('example from the task', () => {
  expect(rangeTotals([3, 1, 4, 1, 5], [[1, 3], [0, 4]])).toEqual([6, 14]);
});

test('a range can start on day 0', () => {
  expect(rangeTotals([3, 1, 4, 1, 5], [[0, 2], [0, 0]])).toEqual([8, 3]);
});

test('a range of one day is that day', () => {
  expect(rangeTotals([3, 1, 4, 1, 5], [[4, 4], [2, 2]])).toEqual([5, 4]);
});

test('negative values are counted', () => {
  expect(rangeTotals([-2, 5, -3, 4], [[0, 3], [1, 2]])).toEqual([4, 2]);
});

test('no queries give an empty list', () => {
  expect(rangeTotals([1, 2, 3], [])).toEqual([]);
});

test('the same range asked twice gives the same answer', () => {
  expect(rangeTotals([2, 2, 2], [[0, 2], [0, 2]])).toEqual([6, 6]);
});

test('performance: 100,000 days and 100,000 wide queries', () => {
  const n = 100000;
  const steps: number[] = [];
  for (let i = 0; i < n; i++) steps.push((i * 7) % 11);
  const queries: [number, number][] = [];
  for (let i = 0; i < n; i++) queries.push([i % 1000, n - 1 - (i % 1000)]);
  const answers = rangeTotals(steps, queries);
  expect(answers).toHaveLength(n);
  expect(answers[0]).toBe(500001);
  expect(answers[999]).toBe(490007);
});
