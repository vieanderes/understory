function solution(A: number[], K: number): number {
  // A period (P, Q) totals K when prefix[Q + 1] - prefix[P] === K, so for each running
  // total, count the earlier running totals equal to it minus K: O(N).
  const LIMIT = 1_000_000_000;
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
