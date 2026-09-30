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
  // Tries once. Retry what may pass next time, with a random wait that grows.
  return fn();
}
