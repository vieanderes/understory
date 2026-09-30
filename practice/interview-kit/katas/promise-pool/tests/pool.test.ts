import { describe, expect, it } from 'vitest';
import { runPool, type Task } from '../src/pool';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Tasks the test finishes by hand, recording which have started and the peak in flight. */
function controlledTasks(count: number) {
  const gates = Array.from({ length: count }, () => deferred<number>());
  const started: number[] = [];
  const signals: AbortSignal[] = [];
  let inFlight = 0;
  let peak = 0;
  const tasks: Task<number>[] = gates.map((gate, index) => async (signal) => {
    started.push(index);
    signals[index] = signal;
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    try {
      return await gate.promise;
    } finally {
      inFlight -= 1;
    }
  });
  return { tasks, gates, started, signals, peak: () => peak };
}

describe('runPool', () => {
  it('rejects a concurrency that is not a positive integer', () => {
    expect(() => runPool([], { concurrency: 0 })).toThrow(RangeError);
    expect(() => runPool([], { concurrency: 2.5 })).toThrow(RangeError);
  });

  it('resolves an empty list with an empty array', async () => {
    await expect(runPool([], { concurrency: 3 })).resolves.toEqual([]);
  });

  it('never runs more than the limit at once and starts the next task when one finishes', async () => {
    const { tasks, gates, started, peak } = controlledTasks(5);
    const result = runPool(tasks, { concurrency: 2 });
    await flush();
    expect(started).toEqual([0, 1]);

    gates[1]!.resolve(1);
    await flush();
    expect(started).toEqual([0, 1, 2]);

    for (const [index, gate] of gates.entries()) gate.resolve(index);
    await expect(result).resolves.toEqual([0, 1, 2, 3, 4]);
    expect(peak()).toBe(2);
  });

  it('keeps input order when tasks finish out of order', async () => {
    const { tasks, gates } = controlledTasks(3);
    const result = runPool(tasks, { concurrency: 3 });
    await flush();
    gates[2]!.resolve(30);
    gates[0]!.resolve(10);
    gates[1]!.resolve(20);
    await expect(result).resolves.toEqual([10, 20, 30]);
  });

  it('copes with a limit larger than the number of tasks', async () => {
    const tasks = [1, 2, 3].map((n) => async () => n * 2);
    await expect(runPool(tasks, { concurrency: 10 })).resolves.toEqual([2, 4, 6]);
  });

  it('fails fast: rejects with the first error, starts nothing new and aborts the rest', async () => {
    const { tasks, gates, started, signals } = controlledTasks(5);
    const result = runPool(tasks, { concurrency: 2 });
    const failure = new Error('boom');
    await flush();

    gates[0]!.reject(failure);
    await expect(result).rejects.toBe(failure);
    await flush();

    expect(started).toEqual([0, 1]);
    expect(signals[1]!.aborted).toBe(true);
  });

  it('treats a task that throws synchronously as a rejection', async () => {
    const failure = new Error('sync');
    const tasks: Task<number>[] = [
      () => {
        throw failure;
      },
    ];
    await expect(runPool(tasks, { concurrency: 1 })).rejects.toBe(failure);
  });

  it('with failFast false, settles every task in order', async () => {
    const failure = new Error('nope');
    const tasks: Task<number>[] = [
      async () => 1,
      async () => {
        throw failure;
      },
      async () => 3,
    ];
    await expect(runPool(tasks, { concurrency: 1, failFast: false })).resolves.toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: failure },
      { status: 'fulfilled', value: 3 },
    ]);
  });

  it('runs 10,000 tasks with a small limit', async () => {
    const tasks = Array.from({ length: 10_000 }, (_, i) => async () => i);
    const result = await runPool(tasks, { concurrency: 8 });
    expect(result).toHaveLength(10_000);
    expect(result[9_999]).toBe(9_999);
  });
});
