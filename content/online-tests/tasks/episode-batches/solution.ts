function solution(K: number, A: number[]): number {
  // Greedy check: fill each batch until the next episode would exceed the cap.
  const batchesNeeded = (cap: number): number => {
    let batches = 1;
    let current = 0;
    for (const minutes of A) {
      if (current + minutes > cap) {
        batches++;
        current = minutes;
      } else {
        current += minutes;
      }
    }
    return batches;
  };
  // A bigger cap never needs more batches, so the smallest cap that fits is binary-searchable.
  let lo = Math.max(...A);
  let hi = A.reduce((sum, x) => sum + x, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (batchesNeeded(mid) <= K) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
