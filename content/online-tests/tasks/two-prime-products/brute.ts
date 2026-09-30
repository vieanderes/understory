function solution(N: number, R: number[][]): number[] {
  // Correct, but factorises every number of every query again: O(M * N * sqrt(N)).
  const isProduct = (x: number): boolean => {
    for (let p = 2; p * p <= x; p++) {
      if (x % p === 0) {
        const q = x / p;
        if (q === p) return false;
        for (let d = 2; d * d <= q; d++) if (q % d === 0) return false;
        return true;
      }
    }
    return false;
  };
  return R.map(([a, b]) => {
    let total = 0;
    for (let x = a; x <= b; x++) if (isProduct(x)) total++;
    return total;
  });
}
