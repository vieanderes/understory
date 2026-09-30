function solution(K: number, A: number[]): number {
  // Correct, but grows a fresh set from every start: O(N**2) when K is large.
  let total = 0;
  for (let p = 0; p < A.length; p++) {
    const labels = new Set<number>();
    for (let q = p; q < A.length; q++) {
      labels.add(A[q]);
      if (labels.size > K) break;
      total++;
    }
  }
  return total;
}
