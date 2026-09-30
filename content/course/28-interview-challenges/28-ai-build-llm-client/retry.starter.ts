// What a failed call throws when the API answered with an error status.
export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

// What an attempt throws when the model took too long.
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// An AbortSignal has this shape, so a real one can be passed in.
export type Signal = { readonly aborted: boolean };
export type ModelCall = (prompt: string, signal: Signal) => Promise<string>;

export type RetryOptions = {
  timeoutMs: number;
  retries: number; // extra attempts after the first
  baseMs: number;
  sleep: (ms: number) => Promise<void>;
  random: () => number; // from 0 up to 1, like Math.random
};

export async function callWithRetry(call: ModelCall, prompt: string, options: RetryOptions): Promise<string> {
  // One attempt, no deadline, no retries. Make it survive a hang, a 429 and a 503.
  return call(prompt, { aborted: false });
}
