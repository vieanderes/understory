import { countPeriods } from './periods.solution';

test('the example from the statement', () => {
  expect(countPeriods([3, -1, 2, 1, -2], 2)).toBe(3);
});

test('a single change equal to K', () => {
  expect(countPeriods([5], 5)).toBe(1);
});
