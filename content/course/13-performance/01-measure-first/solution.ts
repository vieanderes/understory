// Calls fn once to warm up, then times `runs` calls with `now`.
// Returns the median time in milliseconds.
export function measure(fn: () => void, runs: number, now: () => number): number {
  fn();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = now();
    fn();
    times.push(now() - start);
  }
  times.sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  if (times.length % 2 === 1) return times[middle] ?? 0;
  return ((times[middle - 1] ?? 0) + (times[middle] ?? 0)) / 2;
}
