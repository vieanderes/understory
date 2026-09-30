test('turns the text "8080" into the number 8080', () => {
  expect(portFrom({ PORT: '8080' })).toBe(8080);
});

test('adding 1 now gives 8081, not "80801"', () => {
  expect(portFrom({ PORT: '8080' }) + 1).toBe(8081);
});

test('uses 3000 when PORT is missing', () => {
  expect(portFrom({})).toBe(3000);
});

test('uses 3000 when PORT is empty', () => {
  expect(portFrom({ PORT: '' })).toBe(3000);
});

test('uses 3000 when PORT is not a number', () => {
  expect(portFrom({ PORT: 'eighty' })).toBe(3000);
});

test('ignores the other variables', () => {
  expect(portFrom({ HOME: '/home/dev', PORT: '4000' })).toBe(4000);
});
