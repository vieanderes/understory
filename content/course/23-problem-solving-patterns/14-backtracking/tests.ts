import { budgetCombos } from './solution';

test('example from the task', () => {
  expect(budgetCombos([8, 2, 6, 4, 5, 3], 10)).toEqual([
    [2, 3, 5],
    [2, 8],
    [4, 6],
  ]);
});

test('each item is used at most once', () => {
  expect(budgetCombos([5], 10)).toEqual([]);
  expect(budgetCombos([5, 1], 10)).toEqual([]);
});

test('no items give no combinations', () => {
  expect(budgetCombos([], 7)).toEqual([]);
});

test('nothing fits the budget', () => {
  expect(budgetCombos([4, 9, 12], 3)).toEqual([]);
});

test('the input array is untouched', () => {
  const prices = [3, 1, 2];
  expect(budgetCombos(prices, 3)).toEqual([[1, 2], [3]]);
  expect(prices).toEqual([3, 1, 2]);
});

test('performance: 40 prices', () => {
  const prices: number[] = [];
  for (let price = 40; price >= 1; price--) prices.push(price);
  const result = budgetCombos(prices, 10);
  expect(result).toHaveLength(10);
  expect(result[0]).toEqual([1, 2, 3, 4]);
  expect(result[9]).toEqual([10]);
});
