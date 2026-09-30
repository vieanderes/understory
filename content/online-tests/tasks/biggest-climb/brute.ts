function solution(A: number[]): number {
  // Correct, but it tries every pair of readings: O(N**2).
  let best = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = i + 1; j < A.length; j++) best = Math.max(best, A[j]! - A[i]!);
  }
  return best;
}
