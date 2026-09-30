/*
 * One way out to the network for every source, so the manners are the same everywhere:
 * a User-Agent that names the project, a timeout, one retry with a pause, and a size cap.
 * `fetch` and `sleep` are injected, which is what lets the tests run without a network.
 */

export const USER_AGENT =
  'UnderstorySignal/1.0 (personal news digest; +https://github.com/vieanderes/understory)';

export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_BACKOFF_MS = 2_000;
/** Dan Luu's feed is 6.5 MB. Anything far beyond that is not a feed. */
export const MAX_RESPONSE_BYTES = 12_000_000;

/** One retry. A source that fails twice is reported and the run goes on without it. */
const MAX_ATTEMPTS = 2;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type Sleep = (ms: number) => Promise<void>;

export interface HttpDeps {
  fetch: FetchLike;
  sleep: Sleep;
}

export interface PoliteOptions {
  timeoutMs?: number;
  backoffMs?: number;
  accept?: string;
  init?: RequestInit;
}

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} from ${url}`);
    this.name = 'HttpError';
  }
}

/** Worth a second try: the server was busy or asked us to slow down. A 404 is not. */
function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500;
  return true;
}

async function attempt(deps: HttpDeps, url: string, options: PoliteOptions): Promise<string> {
  const { headers, ...init } = options.init ?? {};
  const response = await deps.fetch(url, {
    ...init,
    headers: {
      'user-agent': USER_AGENT,
      accept: options.accept ?? '*/*',
      ...(headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) throw new HttpError(url, response.status);
  const body = await response.text();
  if (body.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Response from ${url} is larger than ${MAX_RESPONSE_BYTES} bytes.`);
  }
  return body;
}

export async function politeFetch(
  deps: HttpDeps,
  url: string,
  options: PoliteOptions = {},
): Promise<string> {
  let lastError: unknown;
  for (let tries = 1; tries <= MAX_ATTEMPTS; tries += 1) {
    try {
      return await attempt(deps, url, options);
    } catch (error) {
      lastError = error;
      if (tries === MAX_ATTEMPTS || !isRetryable(error)) break;
      await deps.sleep(options.backoffMs ?? DEFAULT_BACKOFF_MS);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Runs `worker` over `inputs`, at most `limit` at a time, keeping the input order. */
export async function mapWithConcurrency<In, Out>(
  inputs: readonly In[],
  limit: number,
  worker: (input: In, index: number) => Promise<Out>,
): Promise<Out[]> {
  const results = new Array<Out>(inputs.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, inputs.length) }, async () => {
    while (next < inputs.length) {
      const index = next;
      next += 1;
      results[index] = await worker(inputs[index] as In, index);
    }
  });
  await Promise.all(lanes);
  return results;
}
