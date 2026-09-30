test('adds items within the limit', () => {
  const basket = makeBasket(4);
  expect(basket.add(3)).toBe(true);
  expect(basket.count()).toBe(3);
});

test('refuses a request that would pass the limit and changes nothing', () => {
  const basket = makeBasket(4);
  basket.add(3);
  expect(basket.add(2)).toBe(false);
  expect(basket.count()).toBe(3);
});

test('accepts a request that reaches the limit exactly', () => {
  const basket = makeBasket(4);
  expect(basket.add(4)).toBe(true);
  expect(basket.add(1)).toBe(false);
});

test('gives each basket its own count', () => {
  const first = makeBasket(10);
  const second = makeBasket(10);
  first.add(2);
  expect(second.count()).toBe(0);
});

test('keeps the count private', () => {
  const basket = makeBasket(4);
  expect(Object.keys(basket).sort()).toEqual(['add', 'count']);
});
