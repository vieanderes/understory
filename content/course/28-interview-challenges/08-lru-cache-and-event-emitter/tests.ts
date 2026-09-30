import { LRUCache } from './solution';

test('a missing key gives undefined', () => {
  const cache = new LRUCache<string, number>(2);
  expect(cache.get('cart')).toBe(undefined);
});

test('over capacity, the least recently used key goes', () => {
  const cache = new LRUCache<string, number>(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.put('c', 3);
  expect(cache.get('a')).toBe(undefined);
  expect(cache.get('b')).toBe(2);
  expect(cache.size).toBe(2);
});

test('a read makes a key recently used', () => {
  const cache = new LRUCache<string, number>(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.get('a');
  cache.put('c', 3);
  expect(cache.get('a')).toBe(1);
  expect(cache.get('b')).toBe(undefined);
});

test('updating a key keeps one entry and refreshes it', () => {
  const cache = new LRUCache<string, number>(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.put('a', 10);
  cache.put('c', 3);
  expect(cache.size).toBe(2);
  expect(cache.get('a')).toBe(10);
  expect(cache.get('b')).toBe(undefined);
});

test('a cache of one keeps only the latest key', () => {
  const cache = new LRUCache<number, string>(1);
  cache.put(1, 'one');
  cache.put(2, 'two');
  expect(cache.get(1)).toBe(undefined);
  expect(cache.get(2)).toBe('two');
});

test('large: 200,000 reads on a cache of 50,000 stay fast', () => {
  const cache = new LRUCache<number, number>(50000);
  for (let i = 0; i < 50000; i++) cache.put(i, i);
  let sum = 0;
  for (let i = 0; i < 200000; i++) sum += cache.get((i * 7919) % 50000) ?? 0;
  for (let i = 50000; i < 51000; i++) cache.put(i, i);
  expect(sum).toBe(4999900000);
  expect(cache.size).toBe(50000);
  expect(cache.get(0)).toBe(undefined);
  expect(cache.get(50999)).toBe(50999);
});
