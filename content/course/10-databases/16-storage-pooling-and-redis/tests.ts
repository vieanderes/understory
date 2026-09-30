import { cacheGet, cacheSet } from './solution';
import type { Cache } from './solution';

test('a value comes back before its time is up', () => {
  const cache: Cache = {};
  cacheSet(cache, 'product:42', 'Kettle', 60, 1000);
  expect(cacheGet(cache, 'product:42', 1059)).toBe('Kettle');
});

test('a value is gone once its time is up', () => {
  const cache: Cache = {};
  cacheSet(cache, 'product:42', 'Kettle', 60, 1000);
  expect(cacheGet(cache, 'product:42', 1060)).toBe(null);
});

test('an expired key is removed from the cache', () => {
  const cache: Cache = {};
  cacheSet(cache, 'product:42', 'Kettle', 2, 1000);
  cacheGet(cache, 'product:42', 1002);
  expect(Object.keys(cache)).toEqual([]);
});

test('a key never set is null', () => {
  expect(cacheGet({}, 'product:7', 1000)).toBe(null);
});

test('setting again replaces the value and the expiry', () => {
  const cache: Cache = {};
  cacheSet(cache, 'product:42', 'Kettle', 2, 1000);
  cacheSet(cache, 'product:42', 'Teapot', 60, 1001);
  expect(cacheGet(cache, 'product:42', 1030)).toBe('Teapot');
});
