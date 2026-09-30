import { parsePrice } from './solution';

test('accepts a well-formed price', () => {
  expect(parsePrice({ amountPence: 4500, currency: 'GBP' })).toEqual({
    ok: true,
    value: { amountPence: 4500, currency: 'GBP' },
  });
});

test('rejects an amount that arrives as a string', () => {
  expect(parsePrice(JSON.parse('{"amountPence":"4500","currency":"GBP"}'))).toEqual({
    ok: false,
    error: 'amountPence',
  });
});

test('rejects null, undefined and text without throwing', () => {
  expect(parsePrice(null)).toEqual({ ok: false, error: 'input' });
  expect(parsePrice(undefined)).toEqual({ ok: false, error: 'input' });
  expect(parsePrice('4500 GBP')).toEqual({ ok: false, error: 'input' });
});

test('rejects NaN, a fraction and a negative amount', () => {
  expect(parsePrice({ amountPence: NaN, currency: 'GBP' })).toEqual({ ok: false, error: 'amountPence' });
  expect(parsePrice({ amountPence: 45.5, currency: 'GBP' })).toEqual({ ok: false, error: 'amountPence' });
  expect(parsePrice({ amountPence: -1, currency: 'GBP' })).toEqual({ ok: false, error: 'amountPence' });
});

test('accepts a free ticket of 0 pence', () => {
  expect(parsePrice({ amountPence: 0, currency: 'EUR' }).ok).toBe(true);
});

test('rejects a missing or unknown currency', () => {
  expect(parsePrice({ amountPence: 4500 })).toEqual({ ok: false, error: 'currency' });
  expect(parsePrice({ amountPence: 4500, currency: 'USD' })).toEqual({ ok: false, error: 'currency' });
});

test('returns a new object with only the two checked fields', () => {
  const result = parsePrice({ amountPence: 4500, currency: 'GBP', discountPence: 4500 });
  expect(result).toEqual({ ok: true, value: { amountPence: 4500, currency: 'GBP' } });
});
