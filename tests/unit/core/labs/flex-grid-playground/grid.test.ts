import { describe, expect, it } from 'vitest';
import {
  resolveTracks,
  trackCss,
  trackListCss,
  type Track,
} from '@/core/labs/flex-grid-playground';
import { mulberry32 } from '@/core/util';

const sizes = (w: number, gap: number, tracks: readonly Track[], items?: number) =>
  resolveTracks(w, gap, tracks, items).tracks.map((t) => Math.round(t.size * 100) / 100);

const FILL: Track = { kind: 'repeat', mode: 'auto-fill', min: 100, max: 1, maxUnit: 'fr' };
const FIT: Track = { ...FILL, mode: 'auto-fit' };

describe('resolveTracks (CSS Grid 1 section 11)', () => {
  it('resolves px tracks and gaps first, then fr shares the remainder', () => {
    const r = resolveTracks(320, 8, [
      { kind: 'px', size: 96 },
      { kind: 'fr', fr: 1 },
      { kind: 'fr', fr: 2 },
    ]);
    expect(r.gapTotal).toBe(16);
    expect(r.fixedTotal).toBe(96);
    expect(r.leftover).toBe(208);
    expect(r.flexSum).toBe(3);
    expect(r.frSize).toBeCloseTo(69.33, 2);
    expect(r.tracks.map((t) => t.source)).toEqual([0, 1, 2]);
    expect(
      sizes(320, 8, [
        { kind: 'px', size: 96 },
        { kind: 'fr', fr: 1 },
        { kind: 'fr', fr: 2 },
      ]),
    ).toEqual([96, 69.33, 138.67]);
  });

  it('counts a sum of fr factors below 1 as 1', () => {
    expect(sizes(320, 0, [{ kind: 'fr', fr: 0.5 }])).toEqual([160]);
  });

  it('sizes an auto track to the content passed in, before fr', () => {
    expect(
      sizes(320, 0, [
        { kind: 'auto', content: 64 },
        { kind: 'fr', fr: 1 },
      ]),
    ).toEqual([64, 256]);
  });

  it('stretches auto tracks equally when no fr track claims the rest', () => {
    const r = resolveTracks(320, 0, [
      { kind: 'auto', content: 40 },
      { kind: 'auto', content: 60 },
    ]);
    expect(r.stretched).toBe(220);
    expect(r.frSize).toBeNull();
    expect(r.tracks.map((t) => t.size)).toEqual([150, 170]);
    expect(sizes(320, 0, [{ kind: 'auto' }, { kind: 'px', size: 120 }])).toEqual([200, 120]);
  });

  it('does not stretch when nothing is free, or when there is no auto track', () => {
    expect(
      sizes(100, 0, [
        { kind: 'auto', content: 80 },
        { kind: 'px', size: 120 },
      ]),
    ).toEqual([80, 120]);
    expect(resolveTracks(320, 0, [{ kind: 'px', size: 120 }]).stretched).toBe(0);
  });

  it('grows a minmax(px, px) track to its maximum before any fr is sized', () => {
    const tracks: Track[] = [
      { kind: 'minmax', min: 80, max: 120, maxUnit: 'px' },
      { kind: 'fr', fr: 1 },
      { kind: 'fr', fr: 2 },
    ];
    const r = resolveTracks(320, 8, tracks);
    expect(r.maximised).toBe(40);
    expect(sizes(320, 8, tracks)).toEqual([120, 61.33, 122.67]);
  });

  it('shares free space equally between minmax tracks, and one that is full leaves the pool', () => {
    const tracks: Track[] = [
      { kind: 'minmax', min: 50, max: 60, maxUnit: 'px' },
      { kind: 'minmax', min: 50, max: 400, maxUnit: 'px' },
    ];
    expect(sizes(320, 0, tracks)).toEqual([60, 260]);
    expect(sizes(90, 0, tracks)).toEqual([50, 50]);
  });

  it('floors a maximum below the minimum by the minimum', () => {
    expect(sizes(320, 0, [{ kind: 'minmax', min: 120, max: 80, maxUnit: 'px' }])).toEqual([120]);
  });

  it('lets a flexible track keep a minimum larger than its share, and shares the rest again', () => {
    const tracks: Track[] = [
      { kind: 'minmax', min: 150, max: 1, maxUnit: 'fr' },
      { kind: 'fr', fr: 1 },
      { kind: 'fr', fr: 1 },
    ];
    const r = resolveTracks(320, 0, tracks);
    expect(r.leftover).toBe(320);
    expect(r.frPool).toBe(170);
    expect(r.frSize).toBe(85);
    expect(r.tracks.map((t) => t.size)).toEqual([150, 85, 85]);
  });

  it('gives fr nothing when the fixed tracks already overflow', () => {
    expect(
      sizes(100, 0, [
        { kind: 'px', size: 120 },
        { kind: 'fr', fr: 1 },
      ]),
    ).toEqual([120, 0]);
  });
});

describe('repeat(auto-fill | auto-fit) (CSS Grid 1 section 7.2.3.2)', () => {
  it('fits as many repetitions as the minimum and the gaps allow', () => {
    const r = resolveTracks(320, 8, [FILL], 2);
    expect(r.repetitions).toBe(3);
    expect(r.repeatUnit).toBe(100);
    expect(r.tracks.every((t) => t.source === 0 && !t.collapsed)).toBe(true);
    expect(sizes(320, 8, [FILL], 2)).toEqual([101.33, 101.33, 101.33]);
  });

  it('collapses empty auto-fit repetitions and their gaps', () => {
    const r = resolveTracks(320, 8, [FIT], 2);
    expect(r.gapTotal).toBe(8);
    expect(r.tracks.map((t) => t.collapsed)).toEqual([false, false, true]);
    expect(r.tracks.map((t) => t.size)).toEqual([156, 156, 0]);
  });

  it('makes auto-fit and auto-fill agree once every column has an item', () => {
    expect(sizes(320, 8, [FIT], 3)).toEqual(sizes(320, 8, [FILL], 3));
    expect(sizes(320, 8, [FIT])).toEqual(sizes(320, 8, [FILL]));
    expect(sizes(320, 8, [FIT], 0)).toEqual([0, 0, 0]);
  });

  it('counts a repetition at its px maximum when it has one', () => {
    const tracks: Track[] = [{ ...FILL, max: 150, maxUnit: 'px' }];
    expect(resolveTracks(320, 8, tracks).repetitions).toBe(2);
    expect(sizes(320, 8, tracks)).toEqual([150, 150]);
  });

  it('never repeats less than once', () => {
    expect(sizes(320, 8, [{ ...FILL, min: 400 }])).toEqual([400]);
  });

  it('takes px tracks beside repeat() into account, and occupies them first', () => {
    const tracks: Track[] = [{ kind: 'px', size: 96 }, FIT];
    const r = resolveTracks(320, 8, tracks, 2);
    expect(r.repetitions).toBe(2);
    expect(r.tracks.map((t) => t.size)).toEqual([96, 216, 0]);
  });

  it('rejects a second repeat() and flexible tracks beside repeat()', () => {
    expect(() => resolveTracks(320, 8, [FILL, FIT])).toThrow(RangeError);
    expect(() => resolveTracks(320, 8, [{ kind: 'fr', fr: 1 }, FILL])).toThrow(RangeError);
  });

  it('fills the container exactly whenever a flexible track has room (seeded)', () => {
    const rng = mulberry32(131);
    const int = (max: number) => Math.floor(rng.next() * (max + 1));
    for (let n = 0; n < 500; n += 1) {
      const tracks: Track[] = [
        { kind: 'px', size: int(80) },
        { kind: 'auto', content: int(40) },
        { kind: 'minmax', min: int(40), max: int(80), maxUnit: 'px' },
        { kind: 'fr', fr: 1 + int(3) },
      ];
      const gap = int(16);
      const r = resolveTracks(320, gap, tracks);
      const used = r.tracks.reduce((a, t) => a + t.size, 0) + r.gapTotal;
      expect(used).toBeCloseTo(320, 6);
      r.tracks.forEach((t) => expect(t.size).toBeGreaterThanOrEqual(0));
    }
  });
});

describe('track CSS', () => {
  it('writes each track as CSS', () => {
    expect(trackCss({ kind: 'px', size: 96 })).toBe('96px');
    expect(trackCss({ kind: 'fr', fr: 2 })).toBe('2fr');
    expect(trackCss({ kind: 'auto' })).toBe('auto');
    expect(trackCss({ kind: 'minmax', min: 80, max: 120, maxUnit: 'px' })).toBe(
      'minmax(80px, 120px)',
    );
    expect(trackListCss([FIT])).toBe('repeat(auto-fit, minmax(100px, 1fr))');
    expect(
      trackListCss([
        { kind: 'px', size: 96 },
        { kind: 'fr', fr: 1 },
      ]),
    ).toBe('96px 1fr');
  });
});
