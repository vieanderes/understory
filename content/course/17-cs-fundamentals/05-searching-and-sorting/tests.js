const scores = [3, 8, 12, 15, 21, 27, 30];

test('finds the position of a value that is present', () => {
  expect(firstAtLeast(scores, 15)).toBe(3);
});

test('finds where a missing value would go', () => {
  expect(firstAtLeast(scores, 13)).toBe(3);
  expect(firstAtLeast(scores, 28)).toBe(6);
});

test('a value smaller than everything goes at 0', () => {
  expect(firstAtLeast(scores, 1)).toBe(0);
});

test('a value larger than everything goes at the end', () => {
  expect(firstAtLeast(scores, 99)).toBe(7);
});

test('with repeats, it returns the first of them', () => {
  expect(firstAtLeast([5, 8, 8, 8, 9], 8)).toBe(1);
});

test('an empty list gives 0', () => {
  expect(firstAtLeast([], 4)).toBe(0);
});
