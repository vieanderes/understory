test('multiplies price by quantity and adds the fee', () => {
  expect(cartTotal([{ price: '30', quantity: '2' }], 1)).toBe(61);
});

test('returns a number, not text', () => {
  expect(typeof cartTotal([{ price: '30', quantity: '2' }], 1)).toBe('number');
});

test('adds several lines', () => {
  const lines = [
    { price: '30', quantity: '2' },
    { price: '12.5', quantity: '4' },
  ];
  expect(cartTotal(lines, 1)).toBe(111);
});

test('skips a line whose quantity is below 1 or not a number', () => {
  const lines = [
    { price: '30', quantity: 'abc' },
    { price: '30', quantity: '0' },
    { price: '30', quantity: '-2' },
    { price: '30', quantity: '' },
    { price: '30', quantity: '1' },
  ];
  expect(cartTotal(lines, 0)).toBe(30);
});

test('an empty cart costs the fee alone', () => {
  expect(cartTotal([], 1)).toBe(1);
});
