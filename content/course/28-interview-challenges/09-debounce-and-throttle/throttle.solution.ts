export interface Timers {
  set(fn: () => void, ms: number): number;
  clear(id: number | undefined): void;
}

export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  interval: number,
  timers: Timers,
): (...args: A) => void {
  let waiting = false;
  // Only the latest call made during an interval matters: it runs when the interval ends.
  let pendingArgs: A | undefined;

  const release = () => {
    if (pendingArgs === undefined) {
      waiting = false;
      return;
    }
    const args = pendingArgs;
    pendingArgs = undefined;
    fn(...args);
    // The trailing call starts a new interval, so calls stay at least `interval` apart.
    timers.set(release, interval);
  };

  return (...args: A) => {
    if (waiting) {
      pendingArgs = args;
      return;
    }
    waiting = true;
    fn(...args);
    timers.set(release, interval);
  };
}
