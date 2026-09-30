// A product has a name, a price, and how many are left.
function product(name, price, stock = 10) {
  return { name, price, stock };
}

test('compares prices as numbers', () => {
  const products = [product('pen', 100), product('pad', 25), product('clip', 9)];
  expect(cheapestInStock(products)).toEqual(['clip', 'pad', 'pen']);
});

test('leaves out products with no stock', () => {
  const products = [product('pen', 100), product('clip', 9, 0), product('pad', 25)];
  expect(cheapestInStock(products)).toEqual(['pad', 'pen']);
});

test('does not change the input array', () => {
  const products = Object.freeze([product('pen', 100), product('clip', 9), product('pad', 25)]);
  cheapestInStock(products);
  expect(products.map((p) => p.name)).toEqual(['pen', 'clip', 'pad']);
});

test('keeps the input order of products with the same price', () => {
  const products = [product('mug', 45), product('pad', 30), product('cap', 45), product('bag', 45)];
  expect(cheapestInStock(products)).toEqual(['pad', 'mug', 'cap', 'bag']);
});

test('returns an empty array for no products', () => {
  expect(cheapestInStock([])).toEqual([]);
});
