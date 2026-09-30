export function bestStreak(changes: number[]): number {
  // Target O(n): carry the best run ending today, and the best seen so far.
  let best = 0;
  for (const change of changes) best = Math.max(best, change);
  return best;
}
