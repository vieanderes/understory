export function largestBanner(H: number[]): number {
  // Correct, but it tries every start and every end: O(N^2).
  let best = 0;
  for (let start = 0; start < H.length; start++) {
    let lowest = Infinity;
    for (let end = start; end < H.length; end++) {
      lowest = Math.min(lowest, H[end]!);
      best = Math.max(best, lowest * (end - start + 1));
    }
  }
  return best;
}
