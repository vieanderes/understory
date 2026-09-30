// The best slice ending at each day either extends the best slice ending the day before
// or starts afresh. Both running values start at -Infinity, not 0, so the first day
// always counts and a list of losses returns its smallest loss, not an empty slice.
export function bestStreak(changes: number[]): number {
  let ending = -Infinity;
  let best = -Infinity;
  for (const change of changes) {
    ending = Math.max(change, ending + change);
    best = Math.max(best, ending);
  }
  return best;
}
