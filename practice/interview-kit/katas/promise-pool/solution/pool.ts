export type Task<T> = (signal: AbortSignal) => Promise<T>;

export type Settled<T> =
  { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

export interface PoolOptions {
  concurrency: number;
  failFast?: boolean;
}

export function runPool<T>(
  tasks: ReadonlyArray<Task<T>>,
  options: { concurrency: number; failFast?: true },
): Promise<T[]>;
export function runPool<T>(
  tasks: ReadonlyArray<Task<T>>,
  options: { concurrency: number; failFast: false },
): Promise<Settled<T>[]>;
export function runPool<T>(
  tasks: ReadonlyArray<Task<T>>,
  { concurrency, failFast = true }: PoolOptions,
): Promise<T[] | Settled<T>[]> {
  // Validate before returning a promise, so a wrong argument fails loudly at the call site.
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`concurrency must be a positive integer, got ${concurrency}`);
  }

  const controller = new AbortController();
  const settled: Settled<T>[] = new Array(tasks.length);
  let next = 0;
  let failure: { reason: unknown } | undefined;

  // Each worker pulls the next index until none are left. Writing into settled[index]
  // keeps input order no matter which task finishes first.
  async function worker(): Promise<void> {
    while (next < tasks.length && !failure) {
      const index = next;
      next += 1;
      try {
        // Wrapping in an async call turns a synchronous throw into a rejection.
        const value = await (async () => tasks[index]!(controller.signal))();
        settled[index] = { status: 'fulfilled', value };
      } catch (reason) {
        settled[index] = { status: 'rejected', reason };
        if (failFast && !failure) {
          failure = { reason };
          controller.abort(reason);
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);

  if (!failFast) return Promise.all(workers).then(() => settled);

  // Reject as soon as the first task fails, without waiting for the others to notice the abort.
  return new Promise<T[]>((resolve, reject) => {
    const firstFailure = new Promise<never>((_, rejectFailure) => {
      controller.signal.addEventListener('abort', () => rejectFailure(controller.signal.reason));
    });
    Promise.race([Promise.all(workers), firstFailure]).then(
      () => resolve(settled.map((result) => (result as { value: T }).value)),
      reject,
    );
  });
}
