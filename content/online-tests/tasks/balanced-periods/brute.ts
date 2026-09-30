function solution(A: number[], K: number): number {
  // Correct, but it tries every start and every end: O(N^2).
  const LIMIT = 1_000_000_000;
  let count = 0;
  for (let start = 0; start < A.length; start++) {
    let sum = 0;
    for (let end = start; end < A.length; end++) {
      sum += A[end]!;
      if (sum === K) count += 1;
    }
  }
  return count > LIMIT ? -1 : count;
}
