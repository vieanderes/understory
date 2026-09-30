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
  options: PoolOptions,
): Promise<T[] | Settled<T>[]> {
  void tasks;
  void options;
  throw new Error('Not implemented');
}
