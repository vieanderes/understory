export function bestRoute(A: number[], K: number): number {
  // Correct, but each stone looks back over up to K stones: O(N * K).
  const n = A.length;
  const best = new Array<number>(n);
  best[0] = A[0]!;
  for (let i = 1; i < n; i++) {
    let top = -Infinity;
    for (let j = Math.max(0, i - K); j < i; j++) top = Math.max(top, best[j]!);
    best[i] = A[i]! + top;
  }
  return best[n - 1]!;
}
