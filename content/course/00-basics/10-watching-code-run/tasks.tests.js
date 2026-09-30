test('counts one task left', () => {
  expect(left).toBe(1);
});

test('shows the count', () => {
  expect(printed()).toContain('Tasks left: 1');
});
