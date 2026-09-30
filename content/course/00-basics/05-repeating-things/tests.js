test('the first line is one #', () => {
  expect(printed()[0]).toBe('#');
});

test('the bar grows by one # each line, up to five', () => {
  expect(printed()).toEqual(['#', '##', '###', '####', '#####']);
});
