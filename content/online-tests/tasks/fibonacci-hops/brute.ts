function solution(A: number[]): number {
  // Correct, but tries every earlier position for every pad: O(N**2).
  const N = A.length;
  const fib = new Set<number>([1, 2]);
  let a = 1;
  let b = 2;
  while (b <= N + 1) {
    [a, b] = [b, a + b];
    fib.add(b);
  }
  const hops: number[] = new Array(N + 2).fill(-1);
  hops[0] = 0;
  for (let pos = 0; pos <= N; pos++) {
    if (pos < N && A[pos] !== 1) continue;
    for (let from = -1; from < pos; from++) {
      const h = hops[from + 1];
      if (h >= 0 && fib.has(pos - from) && (hops[pos + 1] < 0 || h + 1 < hops[pos + 1])) {
        hops[pos + 1] = h + 1;
      }
    }
  }
  return hops[N + 1];
}
