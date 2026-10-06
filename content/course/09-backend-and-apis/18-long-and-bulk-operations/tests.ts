import { applyMergePatch, type Json } from './solution';

const plant: Json = {
  name: 'Fern',
  price: 8,
  tags: ['shade', 'indoor'],
  care: { water: 'weekly', light: 'low' },
};

test('changes the fields in the patch and keeps the rest', () => {
  expect(applyMergePatch(plant, { price: 9 })).toEqual({
    name: 'Fern',
    price: 9,
    tags: ['shade', 'indoor'],
    care: { water: 'weekly', light: 'low' },
  });
});

test('null deletes a field, and deleting a missing field is fine', () => {
  expect(applyMergePatch({ name: 'Fern', price: 8 }, { price: null, discount: null })).toEqual({
    name: 'Fern',
  });
});

test('nested objects are merged, not replaced', () => {
  expect(applyMergePatch(plant, { care: { water: 'daily', light: null } })).toEqual({
    name: 'Fern',
    price: 8,
    tags: ['shade', 'indoor'],
    care: { water: 'daily' },
  });
  expect(applyMergePatch({}, { a: { bb: { ccc: null } } })).toEqual({ a: { bb: {} } });
});

test('an array in the patch replaces the array whole', () => {
  expect(applyMergePatch({ tags: ['shade', 'indoor'] }, { tags: ['pet-safe'] })).toEqual({
    tags: ['pet-safe'],
  });
});

test('a patch that is not an object replaces the target', () => {
  expect(applyMergePatch(plant, 'sold out')).toBe('sold out');
  expect(applyMergePatch({ a: 'b' }, ['c'])).toEqual(['c']);
  expect(applyMergePatch(['a', 'b'], { a: 'c' })).toEqual({ a: 'c' });
});

test('leaves the stored document unchanged', () => {
  const stored: Json = { name: 'Fern', care: { water: 'weekly' } };
  applyMergePatch(stored, { name: null, care: { water: null } });
  expect(stored).toEqual({ name: 'Fern', care: { water: 'weekly' } });
});
