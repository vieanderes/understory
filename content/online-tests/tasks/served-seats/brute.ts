function solution(N: number, K: number[]): number {
  // Correct, but checks every seat against every waiter: O(N * M).
  const gcd = (a: number, b: number): number => {
    while (b !== 0) [a, b] = [b, a % b];
    return a;
  };
  const steps = K.map((k) => gcd(N, k));
  let served = 0;
  for (let x = 0; x < N; x++) {
    if (steps.some((g) => x % g === 0)) served++;
  }
  return served;
}
