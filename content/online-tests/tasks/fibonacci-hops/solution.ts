function solution(A: number[]): number {
  const N = A.length;
  // Fewer than 30 Fibonacci numbers fit below 100,002, so each cell tries only those.
  const fib: number[] = [1, 2];
  while (fib[fib.length - 1] <= N + 1) fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
  // hops[i + 1] is the fewest hops to reach position i; index 0 is the start at -1.
  const hops = new Int32Array(N + 2).fill(-1);
  hops[0] = 0;
  for (let pos = 0; pos <= N; pos++) {
    if (pos < N && A[pos] !== 1) continue;
    let best = -1;
    for (const f of fib) {
      const from = pos - f;
      if (from < -1) break;
      const h = hops[from + 1];
      if (h >= 0 && (best < 0 || h + 1 < best)) best = h + 1;
    }
    hops[pos + 1] = best;
  }
  return hops[N + 1];
}
