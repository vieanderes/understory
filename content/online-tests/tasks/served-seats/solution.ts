function solution(N: number, K: number[]): number {
  const gcd = (a: number, b: number): number => {
    while (b !== 0) [a, b] = [b, a % b];
    return a;
  };
  // A waiter with step k serves exactly the multiples of gcd(N, k).
  const steps = [...new Set(K.map((k) => gcd(N, k)))];
  const primes: number[] = [];
  let rest = N;
  for (let p = 2; p * p <= rest; p++) {
    if (rest % p !== 0) continue;
    primes.push(p);
    while (rest % p === 0) rest /= p;
  }
  if (rest > 1) primes.push(rest);
  const phi = (m: number): number => {
    let out = m;
    for (const p of primes) if (m % p === 0) out = (out / p) * (p - 1);
    return out;
  };
  // Seat x has gcd(x, N) = d for exactly phi(N / d) seats, and it is served when some
  // step divides d. Summing over the divisors of N avoids walking all N seats.
  let served = 0;
  for (let i = 1; i * i <= N; i++) {
    if (N % i !== 0) continue;
    const pair = N / i;
    for (const d of i === pair ? [i] : [i, pair]) {
      if (steps.some((g) => d % g === 0)) served += phi(N / d);
    }
  }
  return served;
}
