function solution(C: number, R: number, T: number[]): number[] {
  // Refill lazily: only when a request arrives, add R for every second since the last one,
  // capped at C. No timer is needed, and a long gap costs one multiplication.
  let tokens = C;
  let last = T[0]!;
  const verdicts: number[] = [];
  for (const time of T) {
    tokens = Math.min(C, tokens + R * (time - last));
    last = time;
    if (tokens > 0) {
      tokens -= 1;
      verdicts.push(1);
    } else {
      verdicts.push(0);
    }
  }
  return verdicts;
}
