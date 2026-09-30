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
  // Correct, but it tries every limit in turn: O(N * sum(A)).
  let limit = 0;
  for (const minutes of A) limit = Math.max(limit, minutes);
  while (!fits(A, K, limit)) limit += 1;
  return limit;
}
