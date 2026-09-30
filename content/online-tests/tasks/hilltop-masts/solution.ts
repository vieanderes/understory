function solution(A: number[]): number {
  const n = A.length;
  // next[i] is the first hilltop at or after i, so a greedy placement jumps from one mast
  // to the next in O(1) instead of scanning the gap.
  const next = new Int32Array(n + 1).fill(-1);
  for (let i = n - 2; i >= 1; i--) {
    next[i] = A[i - 1]! < A[i]! && A[i]! > A[i + 1]! ? i : next[i + 1]!;
  }
  if (n >= 1) next[0] = n >= 2 ? next[1]! : -1;
  // K masts span at least (K - 1) * K positions, so K never passes about sqrt(N), and each K
  // places at most K masts: O(N) in all.
  let best = 0;
  for (let k = 1; (k - 1) * k <= n; k++) {
    let placed = 0;
    let at = next[0]!;
    while (at !== -1 && placed < k) {
      placed++;
      at = at + k < n ? next[at + k]! : -1;
    }
    if (placed > best) best = placed;
  }
  return best;
}
