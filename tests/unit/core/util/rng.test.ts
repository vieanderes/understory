import { describe, expect, it } from 'vitest';
import { intBelow, mulberry32, shuffle } from '@/core/util/rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays within [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('is deterministic for a given rng seed', () => {
    const items = [1, 2, 3, 4, 5];
    expect(shuffle(items, mulberry32(3))).toEqual(shuffle(items, mulberry32(3)));
  });

  it('preserves every element (a permutation, not a subset)', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = shuffle(items, mulberry32(9));
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3];
    const copy = [...items];
    shuffle(items, mulberry32(1));
    expect(items).toEqual(copy);
  });

  it('handles an empty array', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
  });
});

describe('intBelow', () => {
  it('returns 0 for a non-positive bound', () => {
    expect(intBelow(mulberry32(1), 0)).toBe(0);
    expect(intBelow(mulberry32(1), -5)).toBe(0);
  });

  it('stays within [0, maxExclusive)', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 100; i += 1) {
      const value = intBelow(rng, 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
