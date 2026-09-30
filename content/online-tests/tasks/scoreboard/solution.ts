function solution(N: number, A: number[]): number[] {
  // A catch-up is recorded as a floor, not applied to all N scores, so each operation is
  // O(1). Scores below the floor are raised once, at the end: O(N + M).
  const scores = new Array<number>(N).fill(0);
  let floor = 0;
  let max = 0;
  for (const operation of A) {
    if (operation === N + 1) {
      floor = max;
      continue;
    }
    const i = operation - 1;
    scores[i] = Math.max(scores[i]!, floor) + 1;
    if (scores[i]! > max) max = scores[i]!;
  }
  return scores.map((score) => Math.max(score, floor));
}
