function solution(K: number, A: number[]): number {
  // Correct, but a DP over every possible last team: O(N**2).
  const N = A.length;
  const prefix = [0];
  for (const x of A) prefix.push(prefix[prefix.length - 1] + x);
  // best[i] is the most ready teams among the first i volunteers.
  const best: number[] = new Array(N + 1).fill(0);
  for (let i = 1; i <= N; i++) {
    best[i] = best[i - 1];
    for (let j = 0; j < i; j++) {
      if (prefix[i] - prefix[j] >= K) best[i] = Math.max(best[i], best[j] + 1);
    }
  }
  return best[N];
}
