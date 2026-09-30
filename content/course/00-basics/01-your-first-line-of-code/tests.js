test('the first line shows Hello, world', () => {
  expect(printed()[0]).toBe('Hello, world');
});

test('the second line shows the answer to 7 * 6', () => {
  expect(printed()[1]).toBe('42');
});

test('nothing else is shown', () => {
  expect(printed()).toHaveLength(2);
});
