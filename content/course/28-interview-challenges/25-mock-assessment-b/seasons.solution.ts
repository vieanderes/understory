// Can the episodes fit into K seasons of at most `limit` minutes each?
function fits(A: number[], K: number, limit: number): boolean {
  let seasons = 1;
  let current = 0;
  for (const minutes of A) {
    if (current + minutes > limit) {
      seasons += 1;
      current = 0;
    }
    current += minutes;
  }
  return seasons <= K;
}

export function largestSeason(K: number, A: number[]): number {
  // fits() is monotonic: a limit that works keeps working when raised.
  // So binary search the smallest limit that works, between max(A) and sum(A).
  let low = 0;
  let high = 0;
  for (const minutes of A) {
    low = Math.max(low, minutes);
    high += minutes;
  }
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (fits(A, K, middle)) high = middle;
    else low = middle + 1;
  }
  return low;
}
