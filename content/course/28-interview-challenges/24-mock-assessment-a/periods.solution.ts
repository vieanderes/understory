const LIMIT = 1_000_000_000;

export function countPeriods(A: number[], K: number): number {
  // A period (P, Q) sums to K when prefix[Q + 1] - prefix[P] === K.
  // So for each prefix, count the earlier prefixes equal to prefix - K.
  const seen = new Map<number, number>([[0, 1]]);
  let prefix = 0;
  let count = 0;
  for (const change of A) {
    prefix += change;
    count += seen.get(prefix - K) ?? 0;
    if (count > LIMIT) return -1;
    seen.set(prefix, (seen.get(prefix) ?? 0) + 1);
  }
  return count;
}
