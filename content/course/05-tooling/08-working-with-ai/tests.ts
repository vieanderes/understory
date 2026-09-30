import { orderPrice } from './solution';

const items = (count: number, pence: number) => Array.from({ length: count }, () => ({ pence }));

test('a promo code still takes its percentage off the subtotal', () => {
  expect(orderPrice([{ pence: 4500 }, { pence: 4500 }, { pence: 800 }], 10)).toBe(9070);
});

test('five items get the 10 percent group discount', () => {
  expect(orderPrice(items(5, 2000), 0)).toBe(9250);
});

test('four items get no group discount', () => {
  expect(orderPrice(items(4, 2000), 0)).toBe(8250);
});

test('a larger promo replaces the group discount', () => {
  expect(orderPrice(items(5, 2000), 25)).toBe(7750);
});

test('a smaller promo loses to the group discount, and the two never stack', () => {
  expect(orderPrice(items(5, 2000), 5)).toBe(9250);
});

test('an empty order costs nothing, not even the fee', () => {
  expect(orderPrice([], 10)).toBe(0);
});

test('the discount is rounded to a whole penny', () => {
  expect(orderPrice(items(3, 333), 10)).toBe(1149);
});
