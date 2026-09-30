import { breakingChanges } from './solution';

const id = { type: 'number', required: true };
const total = { type: 'number', required: true };
const currency = { type: 'string', required: true };
const v1 = { id, total, currency };

test('adding an optional field breaks nothing', () => {
  const v2 = { id, total, currency, status: { type: 'string', required: false } };
  expect(breakingChanges(v1, v2)).toEqual([]);
});

test('removing a field is breaking', () => {
  expect(breakingChanges(v1, { id, total })).toEqual(['removed currency']);
});

test('renaming is a removal', () => {
  const v2 = { id, currency, amount: { type: 'number', required: false } };
  expect(breakingChanges(v1, v2)).toEqual(['removed total']);
});

test('changing a type is breaking', () => {
  const v2 = { id, currency, total: { type: 'string', required: true } };
  expect(breakingChanges(v1, v2)).toEqual(['changed total from number to string']);
});

test('a new required field is breaking', () => {
  const v2 = { id, total, currency, region: { type: 'string', required: true } };
  expect(breakingChanges(v1, v2)).toEqual(['added required region']);
});

test('reports removals before additions', () => {
  const v2 = { id, total, region: { type: 'string', required: true } };
  expect(breakingChanges(v1, v2)).toEqual(['removed currency', 'added required region']);
});
