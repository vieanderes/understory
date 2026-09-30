import { networkRank } from './network.solution';

test('the example from the task', () => {
  expect(networkRank([1, 2, 3, 3], [2, 3, 1, 4], 4)).toBe(4);
});

test('the road between a pair counts once', () => {
  expect(networkRank([1], [2], 2)).toBe(1);
});

test('two separate chains', () => {
  expect(networkRank([1, 2, 4, 5], [2, 3, 5, 6], 6)).toBe(2);
});

test('no roads give 0', () => {
  expect(networkRank([], [], 3)).toBe(0);
});

test('a road listed from either end counts the same', () => {
  expect(networkRank([2, 3, 1], [1, 1, 4], 4)).toBe(3);
});

test('performance: one hub joined to 100,000 cities', () => {
  const from: number[] = [];
  const to: number[] = [];
  for (let city = 2; city <= 100001; city++) {
    from.push(1);
    to.push(city);
  }
  expect(networkRank(from, to, 100001)).toBe(100000);
});
