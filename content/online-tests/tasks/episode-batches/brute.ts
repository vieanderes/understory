function solution(K: number, A: number[]): number {
  // Correct, but tries every cap upwards from the longest episode: O(N * sum).
  let cap = Math.max(...A);
  for (;;) {
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
    if (batches <= K) return cap;
    cap++;
  }
}
