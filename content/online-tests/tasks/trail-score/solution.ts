function solution(K: number, A: number[]): number {
  const N = A.length;
  // best[i] = A[i] + max(best[i - K..i - 1]). A deque of indices with falling best values
  // keeps that window maximum at its front, so the DP is O(N) instead of O(N * K).
  const best = new Array<number>(N);
  const window = new Int32Array(N);
  let head = 0;
  let tail = 0;
  best[0] = A[0];
  window[tail++] = 0;
  for (let i = 1; i < N; i++) {
    if (window[head] < i - K) head++;
    best[i] = best[window[head]] + A[i];
    while (tail > head && best[window[tail - 1]] <= best[i]) tail--;
    window[tail++] = i;
  }
  return best[N - 1];
}
