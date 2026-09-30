test('an order of 60 ships free', () => {
  expect(shippingCost(60)).toBe(0);
});

test('an order of exactly 50 ships free', () => {
  expect(shippingCost(50)).toBe(0);
});

test('an order of 49 pays 5', () => {
  expect(shippingCost(49)).toBe(5);
});

test('a small order of 10 pays 5', () => {
  expect(shippingCost(10)).toBe(5);
});
