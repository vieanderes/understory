import { formatPrice, total } from './solution';
import * as prices from './solution';

test('formatPrice is exported and shows pounds and pence', () => {
  expect(formatPrice(450)).toBe('£4.50');
});

test('total is exported and adds up the items', () => {
  expect(total([{ pence: 450 }, { pence: 120 }])).toBe('£5.70');
});

test('an empty order totals £0.00', () => {
  expect(total([])).toBe('£0.00');
});

test('pounds stays private to the module', () => {
  expect(prices.pounds).toBe(undefined);
});
