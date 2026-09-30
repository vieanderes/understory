import { garbage, type Heap } from './solution';

const heap: Heap = {
  app: ['cart', 'user'],
  cart: ['item1'],
  item1: [],
  user: [],
  oldCart: ['item9'],
  item9: [],
};

test('everything reachable from a root is kept', () => {
  expect(garbage({ app: ['cart'], cart: ['item1'], item1: [] }, ['app'])).toEqual([]);
});

test('objects nothing reaches are garbage, in sorted order', () => {
  expect(garbage(heap, ['app'])).toEqual(['item9', 'oldCart']);
});

test('with no roots, everything is garbage', () => {
  expect(garbage({ a: ['b'], b: [] }, [])).toEqual(['a', 'b']);
});

test('two objects that only point at each other are still garbage', () => {
  const ring: Heap = { app: [], parent: ['child'], child: ['parent'] };
  expect(garbage(ring, ['app'])).toEqual(['child', 'parent']);
});

test('a cycle among live objects does not trap the search', () => {
  const ring: Heap = { app: ['a'], a: ['b'], b: ['a'], lost: [] };
  expect(garbage(ring, ['app'])).toEqual(['lost']);
});

test('several roots each keep their own objects alive', () => {
  expect(garbage(heap, ['app', 'oldCart'])).toEqual([]);
});
