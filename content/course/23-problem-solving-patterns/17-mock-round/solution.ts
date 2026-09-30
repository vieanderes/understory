// Put every number in a Set. Only a number with no left neighbour starts a run, so each
// run is counted once from its start, and every number is looked at about twice: O(n).
export function longestRun(nums: number[]): number {
  const seen = new Set(nums);
  let best = 0;
  for (const n of seen) {
    if (seen.has(n - 1)) continue;
    let length = 1;
    while (seen.has(n + length)) length++;
    best = Math.max(best, length);
  }
  return best;
}
