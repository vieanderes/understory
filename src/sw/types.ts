/*
 * The few shapes the worker needs from its surroundings, written structurally. The real
 * `Cache`, `CacheStorage` and `ServiceWorkerGlobalScope` satisfy them, and so do the
 * fakes in tests/unit/adapters/sw. Declaring them here also lets these files typecheck
 * under both the WebWorker lib (src/sw/tsconfig.json) and the DOM lib of the root
 * tsconfig, which has no service worker globals.
 */

export interface CacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
  delete(key: string): Promise<boolean>;
  keys(): Promise<readonly { url: string }[]>;
}

export interface CacheStorageLike {
  open(name: string): Promise<CacheLike>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export type FetchLike = (input: Request | string, init?: RequestInit) => Promise<Response>;

/** Everything a strategy touches. Tests pass fakes; the worker passes the real things. */
export interface Env {
  caches: CacheStorageLike;
  fetch: FetchLike;
  origin: string;
}

export interface ExtendableEventLike {
  waitUntil(work: Promise<unknown>): void;
}

export interface FetchEventLike extends ExtendableEventLike {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

export interface MessagePortLike {
  postMessage(message: unknown): void;
}

export interface MessageEventLike extends ExtendableEventLike {
  data: unknown;
  source: MessagePortLike | null;
  ports: readonly MessagePortLike[];
}

export interface WindowClientLike extends MessagePortLike {
  url: string;
}

export interface WorkerScope {
  location: { origin: string };
  caches: CacheStorageLike;
  fetch: FetchLike;
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    matchAll(options?: {
      type?: 'window';
      includeUncontrolled?: boolean;
    }): Promise<readonly WindowClientLike[]>;
  };
  addEventListener(type: 'install' | 'activate', listener: (e: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (e: FetchEventLike) => void): void;
  addEventListener(type: 'message', listener: (e: MessageEventLike) => void): void;
}
