// A cart frozen at every level, so that any change to it throws or is ignored.
function frozenCart() {
  const lines = [
    Object.freeze({ ticket: 'day', quantity: 1 }),
    Object.freeze({ ticket: 'camping', quantity: 2 }),
  ];
  return Object.freeze({ owner: 'guest', lines: Object.freeze(lines) });
}

test('returns a cart with the new quantity', () => {
  const next = setQuantity(frozenCart(), 'day', 3);
  expect(next.lines).toEqual([
    { ticket: 'day', quantity: 3 },
    { ticket: 'camping', quantity: 2 },
  ]);
});

test('leaves the input cart as it was', () => {
  const cart = frozenCart();
  setQuantity(cart, 'day', 3);
  expect(cart).toEqual(frozenCart());
});

test('returns new objects along the path to the change', () => {
  const cart = frozenCart();
  const next = setQuantity(cart, 'day', 3);
  expect(next).not.toBe(cart);
  expect(next.lines).not.toBe(cart.lines);
  expect(next.lines[0]).not.toBe(cart.lines[0]);
});

test('reuses the lines that did not change', () => {
  const cart = frozenCart();
  const next = setQuantity(cart, 'day', 3);
  expect(next.lines[1]).toBe(cart.lines[1]);
});

test('removes the line when the quantity is 0', () => {
  const cart = frozenCart();
  const next = setQuantity(cart, 'day', 0);
  expect(next.lines).toEqual([{ ticket: 'camping', quantity: 2 }]);
  expect(cart.lines).toHaveLength(2);
});

test('keeps the other properties of the cart', () => {
  expect(setQuantity(frozenCart(), 'camping', 1).owner).toBe('guest');
});

test('returns the same cart when no line has the ticket', () => {
  const cart = frozenCart();
  expect(setQuantity(cart, 'vip', 2)).toBe(cart);
});
