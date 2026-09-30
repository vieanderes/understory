export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
  factor?: number;
}

export interface RetryInfo {
  attempt: number;
  delayMs: number;
  error: unknown;
}

export interface RetryOptions extends BackoffOptions {
  retries: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (info: RetryInfo) => void;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
}

export function backoffDelay(
  retryNumber: number,
  { baseMs, maxMs, factor = 2 }: BackoffOptions,
  random: () => number,
): number {
  const ceiling = Math.min(maxMs, baseMs * factor ** (retryNumber - 1));
  // Full jitter: anywhere between zero and the ceiling, so clients that failed together
  // spread out instead of retrying in lockstep.
  return Math.floor(random() * ceiling);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

export function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal!));
    };
    // Remove the listener when the timer wins, or a long-lived signal collects one per retry.
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function retry<T>(
  fn: (attempt: number, signal?: AbortSignal) => Promise<T>,
  {
    retries,
    shouldRetry = () => true,
    onRetry,
    signal,
    sleep = sleepWithSignal,
    random = Math.random,
    ...backoff
  }: RetryOptions,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    if (signal?.aborted) throw abortReason(signal);
    try {
      return await fn(attempt, signal);
    } catch (error) {
      // An abort during the call is the caller's decision, not a transient failure.
      if (signal?.aborted) throw abortReason(signal);
      if (attempt > retries || !shouldRetry(error, attempt)) throw error;
      const delayMs = backoffDelay(attempt, backoff, random);
      onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs, signal);
    }
  }
}
