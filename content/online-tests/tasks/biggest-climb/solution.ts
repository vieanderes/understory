function solution(A: number[]): number {
  // The best climb ending at reading i starts at the lowest reading before it, so one pass
  // that remembers the lowest point so far is enough: O(N).
  let lowest = Infinity;
  let best = 0;
  for (const altitude of A) {
    if (altitude < lowest) lowest = altitude;
    else if (altitude - lowest > best) best = altitude - lowest;
  }
  return best;
}
