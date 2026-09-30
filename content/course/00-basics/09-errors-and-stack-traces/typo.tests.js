test('shows how many tasks there are', () => {
  expect(printed()).toEqual(['2']);
});

test('the list still holds both tasks', () => {
  expect(tasks).toHaveLength(2);
});
