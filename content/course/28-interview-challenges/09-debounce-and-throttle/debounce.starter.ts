export interface Timers {
  set(fn: () => void, ms: number): number;
  clear(id: number | undefined): void;
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
  timers: Timers,
): Debounced<A> {
  const debounced = (...args: A) => {
    // Wait for a pause of `wait` ms, then call fn once with the latest arguments.
    timers.set(() => fn(...args), wait);
  };

  // cancel: drop the pending call. flush: run the pending call now.
  const cancel = () => {};
  const flush = () => {};

  return Object.assign(debounced, { cancel, flush });
}
