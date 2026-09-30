test('a full order shows its city and the standard fee', () => {
  const order = { name: 'Ana', address: { city: 'Leeds' }, shipping: 'standard' };
  expect(shippingLabel(order)).toBe('Ana - Leeds - 3');
});

test('express shipping costs 8', () => {
  const order = { name: 'Ben', address: { city: 'Bath' }, shipping: 'express' };
  expect(shippingLabel(order)).toBe('Ben - Bath - 8');
});

test('a missing address does not throw, and reads "no address"', () => {
  const order = { name: 'Cy', shipping: 'standard' };
  expect(shippingLabel(order)).toBe('Cy - no address - 3');
});

test('an address with no city also falls back', () => {
  const order = { name: 'Dev', address: {}, shipping: 'express' };
  expect(shippingLabel(order)).toBe('Dev - no address - 8');
});

test('an unknown shipping option costs 0', () => {
  const order = { name: 'Eve', address: { city: 'York' }, shipping: 'pigeon' };
  expect(shippingLabel(order)).toBe('Eve - York - 0');
});

test('an empty city is kept, because it is not null or undefined', () => {
  const order = { name: 'Fay', address: { city: '' }, shipping: 'standard' };
  expect(shippingLabel(order)).toBe('Fay -  - 3');
});
