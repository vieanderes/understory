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
  options: BackoffOptions,
  random: () => number,
): number {
  void retryNumber;
  void options;
  void random;
  throw new Error('Not implemented');
}

export async function retry<T>(
  fn: (attempt: number, signal?: AbortSignal) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  void fn;
  void options;
  throw new Error('Not implemented');
}
