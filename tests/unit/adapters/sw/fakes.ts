import type { CacheLike, CacheStorageLike, Env } from '@/sw/types';
import type { Ctx } from '@/sw/strategies';

/*
 * Stand-ins for the surroundings of the service worker: `caches`, `fetch` and the
 * `waitUntil` of a fetch event. They are deliberately literal. `FakeCache` reads a body
 * into memory on `put` and hands out a fresh `Response` on `match`, exactly as a real
 * Cache does, so a test that forgets to clone fails here too.
 */

interface Stored {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: [string, string][];
}

export class FakeCache implements CacheLike {
  readonly entries = new Map<string, Stored>();
  putCount = 0;

  async match(key: string): Promise<Response | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    return new Response(entry.body, {
      status: entry.status,
      statusText: entry.statusText,
      headers: entry.headers,
    });
  }

  async put(key: string, response: Response): Promise<void> {
    this.putCount += 1;
    this.entries.set(key, {
      body: await response.arrayBuffer(),
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers],
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }

  async keys(): Promise<{ url: string }[]> {
    return [...this.entries.keys()].map((key) => ({ url: key }));
  }

  /** The text of one entry, for an assertion about what was kept. */
  async text(key: string): Promise<string | undefined> {
    return (await this.match(key))?.text();
  }
}

export class FakeCaches implements CacheStorageLike {
  readonly named = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    const existing = this.named.get(name);
    if (existing) return existing;
    const made = new FakeCache();
    this.named.set(name, made);
    return made;
  }

  async keys(): Promise<string[]> {
    return [...this.named.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.named.delete(name);
  }

  /** Opens without creating, so a test can ask whether a cache was ever touched. */
  peek(name: string): FakeCache | undefined {
    return this.named.get(name);
  }
}

export const ORIGIN = 'https://understory.test';

export interface TestCtx extends Ctx {
  caches: FakeCaches;
  /** Everything handed to `waitUntil`. Await it before asserting about a cache. */
  settle(): Promise<void>;
}

export function makeCtx(fetch: Env['fetch'], origin = ORIGIN): TestCtx {
  const pending: Promise<unknown>[] = [];
  const caches = new FakeCaches();
  return {
    caches,
    fetch,
    origin,
    waitUntil: (work) => {
      pending.push(work.catch(() => undefined));
    },
    async settle() {
      while (pending.length > 0) await pending.shift();
    },
  };
}

/** A body with a content type, and nothing else to think about. */
export function ok(body: string, contentType = 'text/html; charset=utf-8'): Response {
  return new Response(body, { status: 200, headers: { 'content-type': contentType } });
}

export const html = (body: string): Response => ok(body);
export const rsc = (body: string): Response => ok(body, 'text/x-component');

export const SANDBOX_CSP = "sandbox allow-scripts; default-src 'none'";

/** The sandbox runner as the server sends it: its isolation is in the header. */
export function runnerDocument(body: string, csp: string | null = SANDBOX_CSP): Response {
  const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' };
  if (csp !== null) headers['content-security-policy'] = csp;
  return new Response(body, { status: 200, headers });
}

export function never(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

export function offline(): Promise<Response> {
  return Promise.reject(new TypeError('Failed to fetch'));
}
