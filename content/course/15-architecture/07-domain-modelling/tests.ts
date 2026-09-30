import { makeOrder } from './solution';

test('a new order is placed', () => {
  expect(makeOrder().status()).toBe('placed');
});

test('pay, then ship: the happy path works as before', () => {
  const order = makeOrder();
  order.pay();
  expect(order.status()).toBe('paid');
  order.ship();
  expect(order.status()).toBe('shipped');
});

test('a placed or paid order can be cancelled', () => {
  const placed = makeOrder();
  placed.cancel();
  expect(placed.status()).toBe('cancelled');
  const paid = makeOrder();
  paid.pay();
  paid.cancel();
  expect(paid.status()).toBe('cancelled');
});

test('shipping before paying throws', () => {
  const order = makeOrder();
  expect(() => order.ship()).toThrow('cannot go from placed to shipped');
  expect(order.status()).toBe('placed');
});

test('cancelling a shipped order throws, and it stays shipped', () => {
  const order = makeOrder();
  order.pay();
  order.ship();
  expect(() => order.cancel()).toThrow('cannot go from shipped to cancelled');
  expect(order.status()).toBe('shipped');
});

test('a cancelled order cannot be paid', () => {
  const order = makeOrder();
  order.cancel();
  expect(() => order.pay()).toThrow('cannot go from cancelled to paid');
});
