// A Set answers "is -x here?" in O(1), so one pass over the positives finds every pair.
export function largestK(values: number[]): number {
  const seen = new Set(values);
  let best = 0;
  for (const x of values) {
    if (x > 0 && seen.has(-x)) best = Math.max(best, x);
  }
  return best;
}
