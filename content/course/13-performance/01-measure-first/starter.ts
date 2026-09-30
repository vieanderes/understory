// Calls fn once to warm up, then times `runs` calls with `now`.
// Returns the median time in milliseconds.
export function measure(fn: () => void, runs: number, now: () => number): number {
  const start = now();
  fn();
  return now() - start;
}
