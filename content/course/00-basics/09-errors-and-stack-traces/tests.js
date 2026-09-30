test('shows the order summary', () => {
  expect(printed()).toEqual(['Ada ordered 2 things']);
});

test('countItems still counts a list', () => {
  expect(countItems(['tea'])).toBe(1);
});

test('summary reads the items from the order', () => {
  expect(summary()).toBe('Ada ordered 2 things');
});
