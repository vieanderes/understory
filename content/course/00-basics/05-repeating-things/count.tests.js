test('counts from 1', () => {
  expect(printed()[0]).toBe('1');
});

test('counts all the way to 10', () => {
  expect(printed()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
});
