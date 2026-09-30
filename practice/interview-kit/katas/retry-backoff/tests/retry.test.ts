import { afterEach, describe, expect, it, vi } from 'vitest';
import { backoffDelay, retry } from '../src/retry';

const noSleep = async (_ms: number, _signal?: AbortSignal): Promise<void> => {};

/** Fails `failures` times with the given errors, then resolves with 'ok'. */
function flaky(failures: number, error: unknown = new Error('503')) {
  const fn = vi.fn(async (attempt: number) => {
    if (attempt <= failures) throw error;
    return 'ok';
  });
  return fn;
}

describe('backoffDelay', () => {
  const options = { baseMs: 100, maxMs: 1000 };

  it('doubles the ceiling each retry and caps it at maxMs', () => {
    const top = () => 0.999999;
    expect([1, 2, 3, 4, 5].map((n) => backoffDelay(n, options, top))).toEqual([
      99, 199, 399, 799, 999,
    ]);
  });

  it('applies full jitter between zero and the ceiling', () => {
    expect(backoffDelay(3, options, () => 0)).toBe(0);
    expect(backoffDelay(3, options, () => 0.5)).toBe(200);
  });

  it('respects a custom factor', () => {
    expect(backoffDelay(3, { ...options, factor: 3 }, () => 0.5)).toBe(450);
  });
});

describe('retry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the first success without sleeping', async () => {
    const sleep = vi.fn(noSleep);
    const fn = flaky(0);
    await expect(retry(fn, { retries: 3, baseMs: 100, maxMs: 1000, sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries until success, sleeping the jittered backoff between attempts', async () => {
    const sleep = vi.fn(noSleep);
    const fn = flaky(3);
    const result = await retry(fn, {
      retries: 5,
      baseMs: 100,
      maxMs: 1000,
      sleep,
      random: () => 0.5,
    });
    expect(result).toBe('ok');
    expect(fn.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3, 4]);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([50, 100, 200]);
  });

  it('rejects with the last error once the retries are used up', async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n += 1;
      throw new Error(`failure ${n}`);
    });
    await expect(retry(fn, { retries: 2, baseMs: 10, maxMs: 100, sleep: noSleep })).rejects.toThrow(
      'failure 3',
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops at once when shouldRetry says no', async () => {
    const notFound = Object.assign(new Error('404'), { status: 404 });
    const fn = flaky(5, notFound);
    const shouldRetry = vi.fn((error: unknown) => (error as { status?: number }).status !== 404);
    await expect(
      retry(fn, { retries: 5, baseMs: 10, maxMs: 100, sleep: noSleep, shouldRetry }),
    ).rejects.toBe(notFound);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(notFound, 1);
  });

  it('reports each retry through onRetry', async () => {
    const error = new Error('503');
    const onRetry = vi.fn();
    await retry(flaky(2, error), {
      retries: 3,
      baseMs: 100,
      maxMs: 1000,
      sleep: noSleep,
      random: () => 0.5,
      onRetry,
    });
    expect(onRetry.mock.calls).toEqual([
      [{ attempt: 1, delayMs: 50, error }],
      [{ attempt: 2, delayMs: 100, error }],
    ]);
  });

  it('does not call fn when the signal is already aborted', async () => {
    const controller = new AbortController();
    const reason = new Error('user left');
    controller.abort(reason);
    const fn = flaky(0);
    await expect(
      retry(fn, { retries: 3, baseMs: 10, maxMs: 100, sleep: noSleep, signal: controller.signal }),
    ).rejects.toBe(reason);
    expect(fn).not.toHaveBeenCalled();
  });

  it('stops retrying when aborted during the wait', async () => {
    const controller = new AbortController();
    const reason = new Error('cancelled');
    const fn = flaky(5);
    const sleep = vi.fn(async (_ms: number, signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      controller.abort(reason);
    });
    await expect(
      retry(fn, { retries: 5, baseMs: 10, maxMs: 100, sleep, signal: controller.signal }),
    ).rejects.toBe(reason);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits with real timers by default and cancels the timer on abort', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fn = flaky(5);
    const result = retry(fn, {
      retries: 5,
      baseMs: 1000,
      maxMs: 1000,
      random: () => 0.5,
      signal: controller.signal,
    });
    // Capture the outcome now so the rejection is handled while the timers advance.
    const outcome = result.then(
      () => 'resolved',
      (error: unknown) => (error as Error).message,
    );

    await vi.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    controller.abort(new Error('stop'));
    expect(await outcome).toBe('stop');
    expect(vi.getTimerCount()).toBe(0);
  });
});
