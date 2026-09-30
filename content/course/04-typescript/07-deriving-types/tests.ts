import { applyChanges, type Profile } from './solution';

const ada: Profile = { name: 'Ada', city: 'Leeds', age: 36 };

test('changes the fields that were sent', () => {
  expect(applyChanges(ada, { city: 'York' })).toEqual({ name: 'Ada', city: 'York', age: 36 });
});

test('a field sent as undefined keeps its old value', () => {
  expect(applyChanges(ada, { name: undefined, city: 'York' })).toEqual({
    name: 'Ada',
    city: 'York',
    age: 36,
  });
});

test('an age of 0 is a real change', () => {
  expect(applyChanges(ada, { age: 0 }).age).toBe(0);
});

test('no changes gives an equal profile', () => {
  expect(applyChanges(ada, {})).toEqual(ada);
});

test('leaves the original profile untouched', () => {
  const original: Profile = { name: 'Bo', city: 'Hull', age: 20 };
  const updated = applyChanges(original, { city: 'Bath' });
  expect(original.city).toBe('Hull');
  expect(updated).not.toBe(original);
});
