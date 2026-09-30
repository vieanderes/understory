function solution(A: number[]): number {
  // Correct, but it tries every triple of planks: O(N**3).
  let best = 0;
  const n = A.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = A[i]!;
        const b = A[j]!;
        const c = A[k]!;
        if (a + b > c && b + c > a && a + c > b) best = Math.max(best, a + b + c);
      }
    }
  }
  return best;
}
