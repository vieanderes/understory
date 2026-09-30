/*
 * "Detected time complexity", from the times the scored cases took. The slope of log(time)
 * against log(size) says how time grows with the input: about 1 for a single pass, about 2
 * for a nested loop. A browser clock is noisy and small inputs finish in no time, so only
 * cases large enough to measure count, and the answer stays a range where the platform's
 * does ("O(N) or O(N*log(N))"). With too little signal it says nothing rather than guess.
 */

export interface TimingSample {
  size: number;
  ms: number;
  /** The case hit its limit: the real time is at least `ms`. */
  timedOut?: boolean;
}

const MIN_SIZE = 256;
/** Below this the clock's resolution and the call overhead drown the growth. */
const MIN_MS = 0.5;
const MIN_SPREAD = 8;

export const COMPLEXITY_LABELS = [
  'O(1) or O(log(N))',
  'O(sqrt(N))',
  'O(N) or O(N*log(N))',
  'O(N*sqrt(N))',
  'O(N**2)',
  'O(N**3)',
] as const;
export type ComplexityLabel = (typeof COMPLEXITY_LABELS)[number];

function labelFor(slope: number): ComplexityLabel {
  if (slope < 0.35) return 'O(1) or O(log(N))';
  if (slope < 0.75) return 'O(sqrt(N))';
  if (slope < 1.3) return 'O(N) or O(N*log(N))';
  if (slope < 1.7) return 'O(N*sqrt(N))';
  if (slope < 2.5) return 'O(N**2)';
  return 'O(N**3)';
}

/** Least-squares slope of y on x. */
function slopeOf(points: readonly { x: number; y: number }[]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function detectComplexity(samples: readonly TimingSample[]): ComplexityLabel | undefined {
  const usable = samples.filter((s) => s.size >= MIN_SIZE && Number.isFinite(s.ms));
  if (usable.length < 2) return undefined;
  const sizes = usable.map((s) => s.size);
  if (Math.max(...sizes) / Math.min(...sizes) < MIN_SPREAD) return undefined;

  // A timeout at the largest size already proves superlinear growth when smaller sizes
  // were fast; the limit stands in for its time, a lower bound, so the slope is too.
  const largest = usable.reduce((a, b) => (b.size > a.size ? b : a));
  if (largest.ms < MIN_MS && !largest.timedOut) return 'O(1) or O(log(N))';

  const points = usable
    .filter((s) => s.ms >= MIN_MS || s.timedOut === true)
    .map((s) => ({ x: Math.log(s.size), y: Math.log(Math.max(s.ms, MIN_MS)) }));
  if (points.length < 2) return 'O(1) or O(log(N))';
  return labelFor(slopeOf(points));
}
