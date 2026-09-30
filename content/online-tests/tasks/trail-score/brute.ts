function solution(K: number, A: number[]): number {
  // Correct, but scans the whole window of K checkpoints for each one: O(N * K).
  const N = A.length;
  const best: number[] = [A[0]];
  for (let i = 1; i < N; i++) {
    let top = -Infinity;
    for (let j = Math.max(0, i - K); j < i; j++) top = Math.max(top, best[j]);
    best.push(top + A[i]);
  }
  return best[N - 1];
}
