import { topDistinct } from './solution';

test('the sample from the task', () => {
  expect(topDistinct([90, 100, 85, 100, 9], 3)).toEqual([100, 90, 85]);
});

test('scores with different numbers of digits', () => {
  expect(topDistinct([5, 40, 300, 2000], 4)).toEqual([2000, 300, 40, 5]);
});

test('negative scores', () => {
  expect(topDistinct([-3, -20, -1, -20], 2)).toEqual([-1, -3]);
});

test('fewer distinct scores than k', () => {
  expect(topDistinct([7, 7, 7], 5)).toEqual([7]);
  expect(topDistinct([], 3)).toEqual([]);
});

test('large: 100,000 scores, nearly all different', () => {
  const scores: number[] = [];
  for (let i = 0; i < 100000; i++) scores.push((i * 7919) % 100003);
  expect(topDistinct(scores, 3)).toEqual([100002, 100001, 100000]);
});
