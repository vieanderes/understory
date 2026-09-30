import { describe, expect, it } from 'vitest';
import { resolveFlex, type FlexItem } from '@/core/labs/flex-grid-playground';
import { mulberry32 } from '@/core/util';

const item = (
  grow: number,
  shrink: number,
  basis: number,
  minWidth: FlexItem['minWidth'] = 0,
  minContent?: number,
): FlexItem => ({ label: 'Item', text: 'Item', grow, shrink, basis, minWidth, minContent });

const total = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe('resolveFlex (CSS Flexbox 1 section 9.7)', () => {
  it('hands out free space by grow factor over the sum of grow factors', () => {
    const r = resolveFlex(320, [item(1, 1, 80), item(1, 1, 80), item(2, 1, 80)], 8);
    expect(r.mode).toBe('grow');
    expect(r.available).toBe(304);
    expect(r.sumHypothetical).toBe(240);
    expect(r.initialFreeSpace).toBe(64);
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0]?.shares).toEqual([16, 16, 32]);
    expect(r.sizes).toEqual([96, 96, 112]);
  });

  it('shrinks by shrink factor × base size, so a wider item gives up more', () => {
    const r = resolveFlex(320, [item(0, 1, 200), item(0, 1, 100), item(0, 1, 100)]);
    expect(r.mode).toBe('shrink');
    expect(r.initialFreeSpace).toBe(-80);
    expect(r.rounds[0]?.factorSum).toBe(400);
    expect(r.rounds[0]?.shares).toEqual([-40, -20, -20]);
    expect(r.sizes).toEqual([160, 80, 80]);
  });

  it('clamps an item at its min-width, freezes it, and shares the rest out again', () => {
    const r = resolveFlex(320, [item(0, 1, 200), item(0, 1, 120, 100), item(0, 1, 120)]);
    expect(r.rounds).toHaveLength(2);
    expect(r.rounds[0]?.tentative[1]).toBeCloseTo(87.27, 2);
    expect(r.rounds[0]?.clamped).toEqual([1]);
    expect(r.rounds[1]?.freeSpace).toBe(-100);
    expect(r.rounds[1]?.shares).toEqual([-62.5, 0, -37.5]);
    expect(r.sizes).toEqual([137.5, 100, 82.5]);
  });

  it('keeps clamping until no item is below its minimum', () => {
    const r = resolveFlex(300, [item(0, 1, 200, 190), item(0, 1, 200, 80), item(0, 1, 200)]);
    expect(r.rounds.map((round) => round.clamped)).toEqual([[0], [1], []]);
    expect(r.sizes).toEqual([190, 80, 30]);
  });

  it('will not shrink long text under min-width auto, and overflows', () => {
    const name = item(1, 1, 0, 'auto', 260);
    const r = resolveFlex(320, [name, item(0, 0, 56), item(0, 0, 72)]);
    expect(r.mode).toBe('shrink');
    expect(r.hypothetical).toEqual([260, 56, 72]);
    expect(r.frozenAtStart).toEqual([0, 1, 2]);
    expect(r.rounds).toEqual([]);
    expect(r.sizes).toEqual([260, 56, 72]);
    expect(total(r.sizes)).toBeGreaterThan(320);
  });

  it('fits the same row once min-width is 0', () => {
    const r = resolveFlex(320, [item(1, 1, 0, 0, 260), item(0, 0, 56), item(0, 0, 72)]);
    expect(r.mode).toBe('grow');
    expect(r.frozenAtStart).toEqual([1, 2]);
    expect(r.sizes).toEqual([192, 56, 72]);
  });

  it('treats a missing min-content as zero and a negative min-width as zero', () => {
    expect(resolveFlex(100, [item(0, 1, 200, 'auto')]).sizes).toEqual([100]);
    expect(resolveFlex(100, [item(0, 1, 200, -20)]).mins).toEqual([0]);
  });

  it('lifts a growing item to its minimum and gives the others what is left', () => {
    const r = resolveFlex(320, [item(1, 1, 0, 200), item(1, 1, 100)]);
    expect(r.mode).toBe('grow');
    expect(r.rounds[0]?.clamped).toEqual([0]);
    expect(r.sizes).toEqual([200, 120]);
  });

  it('hands out only a fraction of the free space when the grow factors sum below 1', () => {
    const r = resolveFlex(400, [item(0.25, 1, 100), item(0.25, 1, 100)]);
    expect(r.rounds[0]?.freeSpace).toBe(100);
    expect(r.sizes).toEqual([150, 150]);
  });

  it('cannot shrink items whose base size is zero', () => {
    const r = resolveFlex(100, [item(0, 1, 0, 80), item(0, 1, 0, 80)]);
    expect(r.frozenAtStart).toEqual([0, 1]);
    expect(r.sizes).toEqual([80, 80]);
    expect(resolveFlex(-10, [item(0, 1, 0)]).sizes).toEqual([0]);
  });

  describe('items with padding and border (box-sizing: border-box)', () => {
    const boxed = (base: FlexItem, edges: number): FlexItem => ({ ...base, edges });

    it('weighs shrinking by the inner base size, not the outer one (section 9.7, 4c)', () => {
      const r = resolveFlex(320, [
        boxed(item(0, 1, 200), 18),
        boxed(item(0, 1, 120, 100), 18),
        boxed(item(0, 1, 120), 18),
      ]);
      expect(r.initialFreeSpace).toBe(-120);
      expect(r.rounds[0]?.factorSum).toBe(386);
      expect(r.rounds[0]?.clamped).toEqual([1]);
      expect(r.rounds[1]?.factorSum).toBe(284);
      expect(r.sizes[0]).toBeCloseTo(135.915, 3);
      expect(r.sizes[1]).toBe(100);
      expect(r.sizes[2]).toBeCloseTo(84.085, 3);
      expect(total(r.sizes)).toBeCloseTo(320, 6);
    });

    it('never makes the content box negative: a zero basis is still as wide as its edges', () => {
      const r = resolveFlex(100, [boxed(item(1, 1, 0), 18)]);
      expect(r.hypothetical).toEqual([18]);
      expect(r.initialFreeSpace).toBe(82);
      expect(r.sizes).toEqual([100]);
    });

    it('never shrinks an item below its own padding and border', () => {
      const r = resolveFlex(10, [boxed(item(0, 1, 100), 18)]);
      expect(r.mins).toEqual([18]);
      expect(r.sizes).toEqual([18]);
    });
  });

  it('handles an empty row', () => {
    expect(resolveFlex(320, [], 8)).toMatchObject({ available: 320, sizes: [], rounds: [] });
  });

  it('holds the invariants of the algorithm for any row (seeded)', () => {
    const rng = mulberry32(97);
    const int = (max: number) => Math.floor(rng.next() * (max + 1));
    for (let n = 0; n < 1000; n += 1) {
      const items = [0, 1, 2].map(() =>
        item(int(3), int(3), int(240), rng.next() < 0.3 ? 'auto' : int(120), int(160)),
      );
      const gap = int(16);
      const r = resolveFlex(320, items, gap);
      r.sizes.forEach((size, i) => expect(size).toBeGreaterThanOrEqual(r.mins[i]! - 1e-9));
      expect(r.rounds.length).toBeLessThanOrEqual(items.length);
      if (r.mode === 'grow') {
        items.forEach((it, i) => expect(r.sizes[i]).toBeGreaterThanOrEqual(it.basis));
        if (items.some((it) => it.grow > 0)) expect(total(r.sizes)).toBeCloseTo(r.available, 6);
        else expect(total(r.sizes)).toBeCloseTo(r.sumHypothetical, 6);
      } else {
        r.sizes.forEach((size, i) => expect(size).toBeLessThanOrEqual(r.hypothetical[i]! + 1e-9));
        expect(total(r.sizes)).toBeGreaterThanOrEqual(r.available - 1e-6);
      }
    }
  });
});
