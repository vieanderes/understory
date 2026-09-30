test('the warmest of -5, -2 and -9 is -2', () => {
  expect(warmest([-5, -2, -9])).toBe(-2);
});

test('still works in a warm week', () => {
  expect(warmest([3, 7, 5])).toBe(7);
});

test('a week of one reading gives that reading', () => {
  expect(warmest([-4])).toBe(-4);
});
