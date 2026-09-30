test('shows the city, then the new temperature', () => {
  expect(printed()).toEqual(['Rome', '21']);
});

test('temperature now holds 21', () => {
  expect(temperature).toBe(21);
});
