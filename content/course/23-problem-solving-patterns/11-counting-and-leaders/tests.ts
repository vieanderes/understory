import { firstFreeNumber } from './solution';

test('example from the task', () => {
  expect(firstFreeNumber([3, 1, 6, 4, 1, 2])).toBe(5);
});

test('every number in use: the next one', () => {
  expect(firstFreeNumber([1, 2, 3])).toBe(4);
});

test('an empty list starts at 1', () => {
  expect(firstFreeNumber([])).toBe(1);
});

test('only negatives and zero', () => {
  expect(firstFreeNumber([-1, -3, 0])).toBe(1);
});

test('huge numbers are no help', () => {
  expect(firstFreeNumber([1000000, 2, 1])).toBe(3);
});

test('1 to 10 in order', () => {
  expect(firstFreeNumber([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(11);
});

test('the list is left as it was', () => {
  const used = [3, 1, 2];
  firstFreeNumber(used);
  expect(used).toEqual([3, 1, 2]);
});

test('performance: 300,000 numbers, all in use', () => {
  const n = 300000;
  const used: number[] = [];
  for (let i = 0; i < n; i++) used.push(((i * 7919) % n) + 1);
  expect(firstFreeNumber(used)).toBe(n + 1);
});
