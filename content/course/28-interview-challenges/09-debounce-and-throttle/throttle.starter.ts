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

  return (...args: A) => {
    // Calls inside the interval are dropped, so the last one of a burst is lost.
    if (waiting) return;
    waiting = true;
    fn(...args);
    timers.set(() => {
      waiting = false;
    }, interval);
  };
}
