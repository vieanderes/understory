function solution(K: number, A: number[]): number {
  // Correct, but it tries every limit in turn: O(N * sum(A)).
  const fits = (limit: number): boolean => {
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
  };
  let limit = 0;
  for (const minutes of A) limit = Math.max(limit, minutes);
  while (!fits(limit)) limit += 1;
  return limit;
}
