import { checkoutTotal } from './solution';

test('adds delivery to a whole number of pounds', () => {
  expect(checkoutTotal('12')).toBe(15.5);
});

test('adds delivery to pounds and pence', () => {
  expect(checkoutTotal('20.5')).toBe(24);
});

test('a total of 0 still pays for delivery', () => {
  expect(checkoutTotal('0')).toBe(3.5);
});

test('returns a number, not text', () => {
  expect(typeof checkoutTotal('12')).toBe('number');
});
