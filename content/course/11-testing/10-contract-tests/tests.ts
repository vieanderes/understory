import { mismatches } from './solution';

const order = { id: 'number', total: 'number', currency: 'string' } as const;

test('a matching response has no mismatches', () => {
  expect(mismatches(order, { id: 42, total: 1299, currency: 'GBP' })).toEqual([]);
});

test('extra fields from the provider are fine', () => {
  expect(mismatches(order, { id: 42, total: 1299, currency: 'GBP', status: 'paid' })).toEqual([]);
});

test('a missing field is reported', () => {
  expect(mismatches(order, { id: 42, amount: 1299, currency: 'GBP' })).toEqual(['missing total']);
});

test('a changed type is reported with its path', () => {
  expect(mismatches(order, { id: 42, total: '12.99', currency: 'GBP' })).toEqual([
    'total: expected number, got string',
  ]);
});

test('nested shapes report a dotted path', () => {
  const shape = { id: 'number', customer: { name: 'string', vip: 'boolean' } } as const;
  expect(mismatches(shape, { id: 1, customer: { name: 'Ana' } })).toEqual(['missing customer.vip']);
  expect(mismatches(shape, { id: 1, customer: null })).toEqual(['customer: expected object, got null']);
});

test('every problem is listed, in the order of the shape', () => {
  expect(mismatches(order, { total: null, currency: 7 })).toEqual([
    'missing id',
    'total: expected number, got null',
    'currency: expected string, got number',
  ]);
});
