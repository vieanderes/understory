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
  let id: number | undefined;
  // Kept apart from the timer, so flush can run the pending call without waiting.
  let lastArgs: A | undefined;

  const run = () => {
    timers.clear(id);
    id = undefined;
    const args = lastArgs;
    lastArgs = undefined;
    if (args) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    timers.clear(id);
    id = timers.set(run, wait);
  };

  const cancel = () => {
    timers.clear(id);
    id = undefined;
    lastArgs = undefined;
  };

  return Object.assign(debounced, { cancel, flush: run });
}
