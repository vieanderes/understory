export function scoreboard(N: number, A: number[]): number[] {
  // Correct, but every reset walks all N counters: O(N * M).
  const counters = new Array<number>(N).fill(0);
  let max = 0;
  for (const operation of A) {
    if (operation === N + 1) {
      for (let i = 0; i < N; i++) counters[i] = max;
    } else {
      const score = counters[operation - 1]! + 1;
      counters[operation - 1] = score;
      if (score > max) max = score;
    }
  }
  return counters;
}
