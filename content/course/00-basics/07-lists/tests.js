test('the average of 2, 4 and 6 is 4', () => {
  expect(average([2, 4, 6])).toBe(4);
});

test('a list of one number averages to that number', () => {
  expect(average([10])).toBe(10);
});

test('the average can be a decimal', () => {
  expect(average([1, 2])).toBe(1.5);
});
