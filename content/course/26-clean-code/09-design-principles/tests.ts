import { AuditedCart, Cart } from './solution';

test('counts one addition for add', () => {
  const cart = new AuditedCart();
  cart.add(500);
  expect(cart.additions).toBe(1);
});

test('counts each item once for addMany', () => {
  const cart = new AuditedCart();
  cart.addMany([100, 200, 300]);
  expect(cart.additions).toBe(3);
});

test('counts a mix of add and addMany', () => {
  const cart = new AuditedCart();
  cart.add(100);
  cart.addMany([200, 300]);
  expect(cart.additions).toBe(3);
});

test('passes the total through from the cart', () => {
  const cart = new AuditedCart();
  cart.addMany([250, 750]);
  expect(cart.total()).toBe(1000);
});

test('holds a Cart instead of extending it', () => {
  expect(new AuditedCart() instanceof Cart).toBe(false);
});
