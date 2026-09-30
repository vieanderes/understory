test('example from the task', () => {
  expect(maxSumOfK([4, 2, 7, 1, 5], 3)).toBe(13);
});

test('the best window can be the last one', () => {
  expect(maxSumOfK([1, 1, 1, 9, 9], 2)).toBe(18);
});

test('all negative values still give the best window', () => {
  expect(maxSumOfK([-5, -2, -8, -1], 2)).toBe(-7);
});

test('k equal to the length sums everything', () => {
  expect(maxSumOfK([3, 4, 5], 3)).toBe(12);
});

test('k larger than the list gives null', () => {
  expect(maxSumOfK([3, 4], 5)).toBe(null);
});

test('k of zero gives null', () => {
  expect(maxSumOfK([3, 4], 0)).toBe(null);
});

test('performance: 1,000,000 values, windows of 10,000', () => {
  const values = [];
  for (let i = 0; i < 1000000; i++) values.push((i * 37) % 101 - 50);
  values[999999] = 1000000;
  expect(maxSumOfK(values, 10000)).toBe(1000000);
});
