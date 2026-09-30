// Every split point P gives left = prefix sum and right = total - left. One pass keeps the
// running prefix, so each split costs O(1) and the whole task is O(n).
export function minSplitGap(entries: number[]): number {
  let total = 0;
  for (const amount of entries) total += amount;

  let left = 0;
  let best = Infinity;
  // The back must keep at least one entry, so the last entry never joins the front.
  for (const amount of entries.slice(0, -1)) {
    left += amount;
    best = Math.min(best, Math.abs(left - (total - left)));
  }
  return best;
}
