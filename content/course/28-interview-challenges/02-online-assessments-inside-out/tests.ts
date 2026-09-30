import { minSplitGap } from './solution';

test('the example from the statement', () => {
  expect(minSplitGap([3, 1, 2, 4, 3])).toBe(1);
});

test('two entries give exactly one split', () => {
  expect(minSplitGap([-1000, 1000])).toBe(2000);
});

test('all negative entries', () => {
  expect(minSplitGap([-3, -5, -2, -4])).toBe(2);
  expect(minSplitGap([-10, -1, -1])).toBe(8);
});

test('equal entries and duplicates', () => {
  expect(minSplitGap([5, 5, 5, 5])).toBe(0);
  expect(minSplitGap([7, 7, 7])).toBe(7);
});

test('the best split can be the last one', () => {
  expect(minSplitGap([1, 1, 1, 1, 10])).toBe(6);
});

test('large: 100,000 entries at the extremes', () => {
  const entries: number[] = [];
  for (let i = 0; i < 100000; i++) entries.push(i % 2 === 0 ? 1000 : -1000);
  entries[99999] = 1000;
  expect(minSplitGap(entries)).toBe(0);
});
