import type { ResolvedTrack, Track, TrackResult } from './types';

interface Working {
  base: number;
  /** Growth limit. Equal to `base` for anything that does not grow while maximising. */
  limit: number;
  /** Flex factor. Zero for a track that is not flexible. */
  flex: number;
  auto: boolean;
  collapsed: boolean;
  source: number;
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

function working(track: Exclude<Track, { kind: 'repeat' }>, source: number): Working {
  const fixed = { flex: 0, auto: false, collapsed: false, source };
  switch (track.kind) {
    case 'px':
      return { ...fixed, base: track.size, limit: track.size };
    case 'auto': {
      const content = track.content ?? 0;
      return { ...fixed, base: content, limit: content, auto: true };
    }
    case 'fr':
      // A flexible track starts at zero and uses its base size as its growth limit
      // (section 11.4), so it takes nothing while tracks are maximised.
      return { ...fixed, base: 0, limit: 0, flex: track.fr };
    case 'minmax':
      return track.maxUnit === 'fr'
        ? { ...fixed, base: track.min, limit: track.min, flex: track.max }
        : // A maximum below the minimum is floored by the minimum (section 7.2.1).
          { ...fixed, base: track.min, limit: Math.max(track.min, track.max) };
  }
}

/**
 * CSS Grid Layout 1 section 7.2.3.2, repeat-to-fill: the largest number of repetitions
 * that does not overflow the container, at least one, counting each repetition at its
 * maximum if that is definite (floored by the minimum), else at its minimum, and
 * counting the gaps. The tracks beside `repeat()` must be definite, here px.
 */
function repetitionCount(
  containerWidth: number,
  gap: number,
  unit: number,
  others: readonly Track[],
): number {
  const otherSizes = others.map((t) => {
    if (t.kind !== 'px') throw new RangeError('Tracks beside repeat() must be px');
    return t.size;
  });
  const room = containerWidth - sum(otherSizes) - gap * (others.length - 1);
  return Math.max(1, Math.floor(room / (unit + gap)));
}

/**
 * Resolves `grid-template-columns` to px for a container of definite width, following
 * CSS Grid Layout 1 section 11 (the track sizing algorithm) in order:
 *
 *  - 11.4 Initialise: px tracks, `auto` tracks (at the content size passed in) and the
 *    minimum of each `minmax()` are resolved first. Flexible tracks start at zero.
 *  - 11.6 Maximise: free space goes equally to `minmax(px, px)` tracks until each
 *    reaches its maximum. This happens before any `fr` is sized.
 *  - 11.7 Expand flexible tracks: the leftover divided by the sum of flex factors (a sum
 *    below 1 counts as 1) is the size of 1fr. A flexible track whose minimum is larger
 *    than its share keeps the minimum, leaves the pool, and the rest is shared again.
 *  - 11.8 Stretch: free space that remains is split equally between `auto` tracks
 *    (`justify-content: normal`).
 *
 * `auto-fit` collapses repetitions with no item in them, and their gaps (section
 * 7.2.3.2). Items are placed one per column in order, so the first `itemCount` columns
 * are occupied.
 *
 * Left out: intrinsic sizing (the caller passes content sizes in, and the automatic
 * minimum of items in `fr` tracks is taken as zero), spanning items, `fit-content()`,
 * alignment other than normal, named lines and areas, and explicit placement.
 */
export function resolveTracks(
  containerWidth: number,
  gap: number,
  tracks: readonly Track[],
  itemCount = Number.POSITIVE_INFINITY,
): TrackResult {
  let repetitions: number | null = null;
  let repeatUnit: number | null = null;
  const list: Working[] = [];

  tracks.forEach((track, source) => {
    if (track.kind !== 'repeat') {
      list.push(working(track, source));
      return;
    }
    if (repetitions !== null) throw new RangeError('Only one repeat() is allowed');
    repeatUnit = track.maxUnit === 'px' ? Math.max(track.min, track.max) : track.min;
    repetitions = repetitionCount(
      containerWidth,
      gap,
      repeatUnit,
      tracks.filter((t) => t !== track),
    );
    const one = working({ ...track, kind: 'minmax' }, source);
    for (let n = 0; n < repetitions; n += 1) {
      const empty = track.mode === 'auto-fit' && list.length >= itemCount;
      list.push(empty ? { ...one, base: 0, limit: 0, flex: 0, collapsed: true } : { ...one });
    }
  });

  const live = list.filter((t) => !t.collapsed);
  const gapTotal = gap * Math.max(0, live.length - 1);
  const space = containerWidth - gapTotal;
  const fixedTotal = sum(list.map((t) => t.base));

  // 11.6: equal shares, and a track that reaches its limit leaves the pool.
  let free = Math.max(0, space - fixedTotal);
  const maximised = Math.min(free, sum(list.map((t) => t.limit - t.base)));
  // Each pass either uses the space up or takes a track to its limit, so one pass per
  // track is enough.
  for (let pass = 0; pass < list.length; pass += 1) {
    const growing = list.filter((t) => t.base < t.limit);
    if (free <= 0 || growing.length === 0) break;
    const share = free / growing.length;
    for (const t of growing) {
      const step = Math.min(share, t.limit - t.base);
      t.base += step;
      free -= step;
    }
  }

  // 11.7.1: find the size of an fr.
  let leftover: number | null = null;
  let frSize: number | null = null;
  let frPool: number | null = null;
  let flexSum: number | null = null;
  let flexible = list.filter((t) => t.flex > 0);
  if (flexible.length > 0) {
    leftover = space - sum(list.filter((t) => t.flex === 0).map((t) => t.base));
    let pool = leftover;
    let fr = 0;
    for (;;) {
      fr = flexible.length > 0 ? pool / Math.max(1, sum(flexible.map((t) => t.flex))) : 0;
      const floored = flexible.filter((t) => fr * t.flex < t.base);
      if (floored.length === 0) break;
      pool -= sum(floored.map((t) => t.base));
      flexible = flexible.filter((t) => !floored.includes(t));
    }
    for (const t of flexible) t.base = fr * t.flex;
    frSize = fr;
    frPool = pool;
    flexSum = Math.max(1, sum(flexible.map((t) => t.flex)));
  }

  // 11.8: what is still free goes to the auto tracks.
  const autos = list.filter((t) => t.auto);
  const stretched = autos.length > 0 ? Math.max(0, space - sum(list.map((t) => t.base))) : 0;
  for (const t of autos) t.base += stretched / autos.length;

  const resolved: ResolvedTrack[] = list.map((t) => ({
    size: t.base,
    source: t.source,
    collapsed: t.collapsed,
  }));
  return {
    tracks: resolved,
    repetitions,
    repeatUnit,
    gapTotal,
    fixedTotal,
    maximised,
    leftover,
    frPool,
    flexSum,
    frSize,
    stretched,
  };
}
