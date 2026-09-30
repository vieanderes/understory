test('prices a plan per seat', () => {
  expect(monthlyPrice('team', 3)).toBe(12);
  expect(monthlyPrice('business', 10)).toBe(30);
});

test('returns null for an unknown plan', () => {
  expect(monthlyPrice('gold', 2)).toBe(null);
  expect(monthlyPrice('constructor', 2)).toBe(null);
});

test('returns null for fewer than one seat', () => {
  expect(monthlyPrice('solo', 0)).toBe(null);
});

test('reads its prices from PRICE_PER_SEAT, so a new plan needs no new branch', () => {
  PRICE_PER_SEAT.set('enterprise', 2);
  expect(monthlyPrice('enterprise', 20)).toBe(40);
  PRICE_PER_SEAT.delete('enterprise');
});
