test('names the threshold and the fee', () => {
  expect(FREE_DELIVERY_THRESHOLD).toBe(50);
  expect(DELIVERY_FEE).toBe(4.99);
});

test('delivery is free from the threshold up', () => {
  expect(deliveryFee(50)).toBe(0);
  expect(deliveryFee(120)).toBe(0);
});

test('charges the fee right below the threshold', () => {
  expect(deliveryFee(49.99)).toBe(4.99);
});

test('charges the fee for an empty basket', () => {
  expect(deliveryFee(0)).toBe(4.99);
});
