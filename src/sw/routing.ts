import { CACHES, CONTENT_INDEX_FILES } from './config';

/*
 * The routing table: one pure function from a request to what the worker does with it.
 * Order matters. The first three rules are the safety rules: only same-origin GETs that
 * are not API calls are ever answered or stored by the worker.
 */

export type Strategy =
  /** Immutable files. The cache answers; the network is asked once. */
  | 'cache-first'
  /** Short-lived files. The cache answers at once and is refreshed behind the response. */
  | 'stale-while-revalidate'
  /** React Server Component payloads. The network answers; the cache stands in offline. */
  | 'network-first'
  /** HTML documents. Stale-while-revalidate, then the offline page when both are empty. */
  | 'navigate';

export type Route =
  | { strategy: 'bypass'; reason: 'method' | 'cross-origin' | 'api' | 'worker' | 'unmatched' }
  | { strategy: Strategy; cache: string; key: string };

/** The part of a Request the table reads. A real Request fits. */
export interface RequestInfoLike {
  method: string;
  url: string;
  mode?: string;
  destination?: string;
  headers: { get(name: string): string | null };
}

const RSC_QUERY = '_rsc';
const SEGMENT_HEADER = 'next-router-segment-prefetch';
const IMMUTABLE_CONTENT = /^\/content\/v1\/(lessons|solutions)\//;
const FONT = /\.(woff2?|ttf|otf)$/;
const INSTALL_FILES = /^\/(icons\/|icon\.svg$|apple-icon\.png$|manifest\.webmanifest$)/;
/** The version is in the path (src/adapters/pyodide/assets.ts), so a file never changes. */
const PYODIDE = /^\/pyodide\/\d+\.\d+\.\d+\//;
/** The hash is in the name (scripts/build-typecheck.ts), so a file never changes. */
const CHECKER = /^\/typescript\/checker\.[0-9a-f]+\.js$/;
const CHECKER_MANIFEST = '/typescript/checker.json';
/** The PGlite version is in the path and the worker's hash in its name (scripts/build-sql.ts). */
const SQL_ENGINE = /^\/sql\/\d+\.\d+\.\d+\/[\w.-]+$/;
const SQL_MANIFEST = '/sql/engine.json';

export function isRscRequest(request: RequestInfoLike, url: URL): boolean {
  return request.headers.get('rsc') === '1' || url.searchParams.has(RSC_QUERY);
}

/**
 * The cache key of an RSC payload.
 *
 * Next adds `?_rsc=<hash>` to every payload request. The hash covers four request
 * headers: next-router-prefetch, next-router-segment-prefetch, next-router-state-tree
 * and next-url. A per-segment prefetch depends on the path and the segment alone, so it
 * is keyed by those two and the hash is dropped: the same payload is then found again
 * whichever page asks for it. A navigation payload is a patch against the router state
 * of the page that asked, so its hash is the only safe key and stays.
 */
export function rscKey(request: RequestInfoLike, url: URL): string {
  const segment = request.headers.get(SEGMENT_HEADER);
  const params = new URLSearchParams(url.search);
  if (segment !== null) {
    params.delete(RSC_QUERY);
    params.set('__segment', segment);
  } else {
    params.set('__payload', 'navigation');
  }
  return `${url.pathname}?${params.toString()}`;
}

export function classify(request: RequestInfoLike, origin: string): Route {
  if (request.method !== 'GET') return { strategy: 'bypass', reason: 'method' };

  const url = new URL(request.url);
  if (url.origin !== origin) return { strategy: 'bypass', reason: 'cross-origin' };

  const path = url.pathname;
  if (path === '/api' || path.startsWith('/api/')) return { strategy: 'bypass', reason: 'api' };
  if (path === '/sw.js') return { strategy: 'bypass', reason: 'worker' };

  // Hashed file names: the path is the whole identity, a deployment query adds nothing.
  if (path.startsWith('/_next/static/') || FONT.test(path)) {
    return { strategy: 'cache-first', cache: CACHES.static, key: path };
  }
  if (PYODIDE.test(path)) {
    return { strategy: 'cache-first', cache: CACHES.python, key: path };
  }
  if (CHECKER.test(path)) {
    return { strategy: 'cache-first', cache: CACHES.typescript, key: path };
  }
  if (path === CHECKER_MANIFEST || path === SQL_MANIFEST) {
    return { strategy: 'stale-while-revalidate', cache: CACHES.static, key: path };
  }
  if (SQL_ENGINE.test(path)) {
    return { strategy: 'cache-first', cache: CACHES.sql, key: path };
  }
  if (IMMUTABLE_CONTENT.test(path)) {
    return { strategy: 'cache-first', cache: CACHES.content, key: path };
  }
  if (CONTENT_INDEX_FILES.includes(path)) {
    return { strategy: 'stale-while-revalidate', cache: CACHES.content, key: path };
  }
  // Before the navigation rule: the runner loads in an iframe, which is a navigation,
  // and it must never be answered with the offline page.
  if (path.startsWith('/sandbox/') || INSTALL_FILES.test(path)) {
    return { strategy: 'stale-while-revalidate', cache: CACHES.static, key: path };
  }
  if (isRscRequest(request, url)) {
    return { strategy: 'network-first', cache: CACHES.pages, key: rscKey(request, url) };
  }
  if (request.mode === 'navigate' || request.destination === 'document') {
    // Pages are static: the query and the fragment do not change the document.
    return { strategy: 'navigate', cache: CACHES.pages, key: path };
  }
  return { strategy: 'bypass', reason: 'unmatched' };
}
