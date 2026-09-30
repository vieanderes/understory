export function scoreboard(N: number, A: number[]): number[] {
  // A reset to the maximum is recorded as a floor, not applied to all N counters, so each
  // operation is O(1). Counters below the floor are raised once, at the end.
  const counters = new Array<number>(N).fill(0);
  let floor = 0;
  let max = 0;
  for (const operation of A) {
    if (operation === N + 1) {
      floor = max;
      continue;
    }
    const i = operation - 1;
    counters[i] = Math.max(counters[i]!, floor) + 1;
    if (counters[i]! > max) max = counters[i]!;
  }
  return counters.map((value) => Math.max(value, floor));
}
