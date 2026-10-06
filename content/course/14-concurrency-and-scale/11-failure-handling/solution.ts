// What a failed call throws when the service answered with an error status.
export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

export interface RetryOptions {
  attempts: number;
  baseMs: number;
  random: () => number; // from 0 up to 1, like Math.random
  sleep: (ms: number) => Promise<void>;
}

export async function retryWithJitter<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retryable =
        error instanceof HttpError
          ? error.status === 429 || error.status >= 500
          : error instanceof Error && error.name === 'TimeoutError';
      if (!retryable || attempt >= options.attempts) throw error;
      // Full jitter: anywhere from 0 up to the backoff, so clients spread out.
      await options.sleep(options.random() * options.baseMs * 2 ** (attempt - 1));
    }
  }
}
