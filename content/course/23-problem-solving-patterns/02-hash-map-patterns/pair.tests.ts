import { twoSum } from './pair.solution';

function expectPair(prices: number[], target: number, pair: [number, number] | null): void {
  expect(pair).not.toBe(null);
  const [i, j] = pair ?? [0, 0];
  expect(i < j).toBe(true);
  expect((prices[i] ?? NaN) + (prices[j] ?? NaN)).toBe(target);
}

test('example from the task', () => {
  expect(twoSum([3, 8, 4, 6], 10)).toEqual([2, 3]);
});

test('no pair gives null', () => {
  expect(twoSum([1, 2, 3], 100)).toBe(null);
});

test('an empty list gives null', () => {
  expect(twoSum([], 5)).toBe(null);
});

test("one price at half the target can't pair with itself", () => {
  expect(twoSum([5, 1], 10)).toBe(null);
});

test('two equal prices can pair, even at position 0', () => {
  expectPair([5, 1, 5], 10, twoSum([5, 1, 5], 10));
});

test('negative prices, as refunds', () => {
  expectPair([-3, 7, 2], 4, twoSum([-3, 7, 2], 4));
});

test('performance: 100,000 prices, pair at the very end', () => {
  const prices = Array.from({ length: 100_000 }, (_, i) => i + 1);
  expect(twoSum(prices, 1e9)).toBe(null);
  const withPartner = [...prices, 1e9 - 1];
  expectPair(withPartner, 1e9, twoSum(withPartner, 1e9));
});
