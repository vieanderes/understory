/**
 * A pure, seeded pseudo-random source. Sessions, property tests and the UUIDv7
 * generator all need reproducible "randomness": the same seed must always give the
 * same sequence, which `Math.random()` cannot promise (LEARNING-SCIENCE.md B2, B4).
 */
export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
}

/**
 * mulberry32: a small, fast, seeded PRNG (public domain). Not cryptographic. Used only
 * where determinism matters more than unpredictability: session composition, the
 * property tests in the progress reducer, and as the entropy source behind UUIDv7.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Fisher-Yates shuffle. Deterministic given `rng`, so a seed reproduces one order. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    // j is always in [0, i] and i is always a valid index, so both reads are safe;
    // the assertion avoids an untestable "impossible" branch under noUncheckedIndexedAccess.
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** An integer in [0, maxExclusive), or 0 when maxExclusive is not positive. */
export function intBelow(rng: Rng, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.floor(rng.next() * maxExclusive);
}
