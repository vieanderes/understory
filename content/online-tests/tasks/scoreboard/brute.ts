function solution(N: number, A: number[]): number[] {
  // Correct, but every catch-up walks all N scores: O(N * M).
  const scores = new Array<number>(N).fill(0);
  let max = 0;
  for (const operation of A) {
    if (operation === N + 1) {
      for (let i = 0; i < N; i++) scores[i] = max;
    } else {
      const score = scores[operation - 1]! + 1;
      scores[operation - 1] = score;
      if (score > max) max = score;
    }
  }
  return scores;
}
