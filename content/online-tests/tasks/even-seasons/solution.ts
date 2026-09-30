function solution(K: number, A: number[]): number {
  // A limit that fits in K seasons keeps fitting when raised, so binary search the
  // smallest one between max(A) and sum(A), checking each with a greedy pass:
  // O(N * log(N * M)).
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
  let low = 0;
  let high = 0;
  for (const minutes of A) {
    low = Math.max(low, minutes);
    high += minutes;
  }
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (fits(middle)) high = middle;
    else low = middle + 1;
  }
  return low;
}
