import { describe, expect, it } from 'vitest';
import { LruCache, type Clock } from '../src/lru-cache';

function fakeClock(start = 0): Clock & { advance(ms: number): void } {
  let now = start;
  return {
    now: () => now,
    advance(ms) {
      now += ms;
    },
  };
}

describe('LruCache: capacity and recency', () => {
  it('rejects a capacity that is not a positive integer', () => {
    expect(() => new LruCache({ capacity: 0 })).toThrow(RangeError);
    expect(() => new LruCache({ capacity: 1.5 })).toThrow(RangeError);
  });

  it('returns what was set and undefined for a missing key', () => {
    const cache = new LruCache<string, number>({ capacity: 2 });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new LruCache<string, number>({ capacity: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('counts a get as a use', () => {
    const cache = new LruCache<string, number>({ capacity: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('does not count has as a use', () => {
    const cache = new LruCache<string, number>({ capacity: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.has('a');
    cache.set('c', 3);
    expect(cache.has('a')).toBe(false);
  });

  it('replaces an existing key at capacity without evicting another', () => {
    const cache = new LruCache<string, number>({ capacity: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);
    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBe(2);
  });

  it('works with a capacity of one', () => {
    const cache = new LruCache<string, number>({ capacity: 1 });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('deletes and reports whether something was removed', () => {
    const cache = new LruCache<string, number>({ capacity: 2 });
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.delete('a')).toBe(false);
    expect(cache.size).toBe(0);
  });
});

describe('LruCache: time to live', () => {
  it('expires entries after the default TTL', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 3, defaultTtlMs: 1000, clock });
    cache.set('a', 1);
    clock.advance(999);
    expect(cache.get('a')).toBe(1);
    clock.advance(1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.has('a')).toBe(false);
  });

  it('lets set override the default TTL per entry', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 3, defaultTtlMs: 1000, clock });
    cache.set('short', 1, { ttlMs: 100 });
    cache.set('long', 2, { ttlMs: 5000 });
    clock.advance(2000);
    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe(2);
  });

  it('treats a TTL of zero as already expired', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 3, clock });
    cache.set('a', 1, { ttlMs: 0 });
    expect(cache.get('a')).toBeUndefined();
  });

  it('never expires without a TTL', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 3, clock });
    cache.set('a', 1);
    clock.advance(10 ** 12);
    expect(cache.get('a')).toBe(1);
  });

  it('counts only live entries in size', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 3, clock });
    cache.set('a', 1, { ttlMs: 10 });
    cache.set('b', 2);
    clock.advance(10);
    expect(cache.size).toBe(1);
  });

  it('evicts expired entries before a live least recently used one', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 2, clock });
    cache.set('old-but-live', 1);
    cache.set('expiring', 2, { ttlMs: 10 });
    clock.advance(10);
    cache.set('new', 3);
    expect(cache.get('old-but-live')).toBe(1);
    expect(cache.get('new')).toBe(3);
  });

  it('gives a re-set expired key a fresh TTL', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 2, defaultTtlMs: 100, clock });
    cache.set('a', 1);
    clock.advance(150);
    cache.set('a', 2);
    clock.advance(50);
    expect(cache.get('a')).toBe(2);
  });

  it('reports delete of an expired entry as nothing removed', () => {
    const clock = fakeClock();
    const cache = new LruCache<string, number>({ capacity: 2, clock });
    cache.set('a', 1, { ttlMs: 5 });
    clock.advance(5);
    expect(cache.delete('a')).toBe(false);
  });
});

describe('LruCache: performance', () => {
  it('handles 200,000 operations quickly', () => {
    const cache = new LruCache<number, number>({ capacity: 1000 });
    const started = performance.now();
    for (let i = 0; i < 100_000; i += 1) {
      cache.set(i, i);
      cache.get(i - 500);
    }
    expect(cache.size).toBe(1000);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
