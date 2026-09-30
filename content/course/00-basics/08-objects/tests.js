test('two items add up to 11', () => {
  expect(cartTotal([{ price: 3, quantity: 2 }, { price: 5, quantity: 1 }])).toBe(11);
});

test('one item costs price times quantity', () => {
  expect(cartTotal([{ price: 4, quantity: 3 }])).toBe(12);
});

test('an empty cart costs 0', () => {
  expect(cartTotal([])).toBe(0);
});
