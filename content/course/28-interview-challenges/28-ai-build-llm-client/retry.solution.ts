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

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500;
  return error instanceof TimeoutError;
}

// One attempt races the call against a timer. If the timer wins, the signal tells the
// call to stop, so a hung request doesn't keep running after we've given up on it.
function attempt(call: ModelCall, prompt: string, options: RetryOptions): Promise<string> {
  const signal = { aborted: false };
  const timer = options.sleep(options.timeoutMs).then((): never => {
    signal.aborted = true;
    throw new TimeoutError(`No answer within ${options.timeoutMs} ms`);
  });
  return Promise.race([call(prompt, signal), timer]);
}

export async function callWithRetry(call: ModelCall, prompt: string, options: RetryOptions): Promise<string> {
  for (let tries = 0; ; tries++) {
    try {
      // `return await` keeps a rejection inside this try, so it can be retried.
      return await attempt(call, prompt, options);
    } catch (error) {
      if (tries >= options.retries || !isRetryable(error)) throw error;
      // Full jitter: anywhere from 0 up to the backoff, so clients spread out.
      await options.sleep(options.random() * options.baseMs * 2 ** tries);
    }
  }
}
