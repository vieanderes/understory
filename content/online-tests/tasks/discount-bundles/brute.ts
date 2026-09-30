function solution(A: number[], K: number): number {
  // Correct, but it tries every pair: O(N^2).
  let count = 0;
  for (let p = 0; p < A.length; p++) {
    for (let q = p + 1; q < A.length; q++) {
      if (A[p]! + A[q]! <= K) count += 1;
    }
  }
  return count;
}
