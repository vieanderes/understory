import { canonical, detectChanges, fnv1a, type PlantRecord } from './solution';

test('the same object in a different key order gives the same text', () => {
  expect(canonical({ name: 'Fern', price: 450 })).toBe(canonical({ price: 450, name: 'Fern' }));
});

test('nested objects are sorted too', () => {
  expect(canonical({ pot: { size: 12, colour: 'grey' }, name: 'Fern' })).toBe(
    '{"name":"Fern","pot":{"colour":"grey","size":12}}',
  );
});

test('arrays keep their order, because order means something there', () => {
  expect(canonical({ tags: ['shade', 'indoor'] })).not.toBe(canonical({ tags: ['indoor', 'shade'] }));
});

test('types still count: "450" is not 450, and null is not "null"', () => {
  expect(canonical({ price: '450' })).not.toBe(canonical({ price: 450 }));
  expect(canonical({ note: null })).not.toBe(canonical({ note: 'null' }));
});

test('a record that only reordered its keys is not a change', () => {
  const stored = new Map([['p-1', fnv1a(canonical({ name: 'Fern', price: 450, stock: 3 }))]]);
  const tonight: PlantRecord[] = [{ id: 'p-1', data: { stock: 3, price: 450, name: 'Fern' } }];
  expect(detectChanges(stored, tonight).changed).toEqual([]);
});

test('new and changed records are reported, and every record gets its hash', () => {
  const stored = new Map([
    ['p-1', fnv1a(canonical({ name: 'Fern', price: 450 }))],
    ['p-2', fnv1a(canonical({ name: 'Ivy', price: 300 }))],
  ]);
  const tonight: PlantRecord[] = [
    { id: 'p-1', data: { price: 450, name: 'Fern' } },
    { id: 'p-2', data: { name: 'Ivy', price: 350 } },
    { id: 'p-3', data: { name: 'Moss', price: 200 } },
  ];
  const { changed, hashes } = detectChanges(stored, tonight);
  expect(changed).toEqual(['p-2', 'p-3']);
  expect(hashes.size).toBe(3);
  expect(hashes.get('p-1')).toBe(stored.get('p-1'));
});
