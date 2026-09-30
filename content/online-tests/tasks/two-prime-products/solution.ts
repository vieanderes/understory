function solution(N: number, R: number[][]): number[] {
  // Smallest-factor sieve: x is a two-prime product when x / spf(x) is a different prime.
  const spf = new Int32Array(N + 1);
  for (let i = 2; i * i <= N; i++) {
    if (spf[i] !== 0) continue;
    for (let j = i * i; j <= N; j += i) if (spf[j] === 0) spf[j] = i;
  }
  // Prefix counts answer every query in O(1).
  const count = new Int32Array(N + 1);
  for (let x = 2; x <= N; x++) {
    let hit = 0;
    if (spf[x] !== 0) {
      const q = x / spf[x];
      if (spf[q] === 0 && q !== spf[x]) hit = 1;
    }
    count[x] = count[x - 1] + hit;
  }
  return R.map(([a, b]) => count[b] - count[a - 1]);
}
