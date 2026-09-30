import { CACHES, NETWORK_TIMEOUT_MS, OFFLINE_HEADER, OFFLINE_URL } from './config';
import type { Route } from './routing';
import type { CacheLike, Env } from './types';

/** What a strategy needs: the surroundings, and a way to keep the worker alive for late work. */
export interface Ctx extends Env {
  waitUntil(work: Promise<unknown>): void;
}

type Storable = (response: Response) => boolean;

/** Only complete, same-origin answers are kept. A 404, a redirect or a partial body is not. */
export const isStorable: Storable = (response) =>
  response.status === 200 && (response.type === 'basic' || response.type === 'default');

const hasType = (response: Response, type: string): boolean =>
  (response.headers.get('content-type') ?? '').startsWith(type);

export const isStorableHtml: Storable = (r) => isStorable(r) && hasType(r, 'text/html');
export const isStorableRsc: Storable = (r) => isStorable(r) && hasType(r, 'text/x-component');

/**
 * The runner's isolation is the `sandbox allow-scripts` directive in its CSP header: the
 * iframe carries no `sandbox` attribute, because a frame with one is never handed to this
 * worker and so could not load offline (docs/SANDBOX.md, "Offline"). A copy without the
 * directive, or with more allowed than scripts, is never kept and never served.
 */
export function hasSandboxCsp(response: Response): boolean {
  const csp = response.headers.get('content-security-policy') ?? '';
  return csp.split(';').some((directive) => directive.trim() === 'sandbox allow-scripts');
}

export const isStorableSandboxDocument: Storable = (r) =>
  isStorable(r) && hasType(r, 'text/html') && hasSandboxCsp(r);

const SANDBOX_DOCUMENT = /^\/sandbox\/[^/]+\.html$/;

/** What may be kept under a cache key. Only the runner document has a stricter rule. */
export function storableFor(key: string): Storable {
  return SANDBOX_DOCUMENT.test(key) ? isStorableSandboxDocument : isStorable;
}

/**
 * A response that followed a redirect cannot answer a navigation: the browser refuses it.
 * A copy made from its parts has lost the flag and keeps the headers, which matters for
 * the sandbox runner, whose Content-Security-Policy header is its isolation.
 */
export function withoutRedirectFlag(response: Response): Response {
  if (!response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function store(cache: CacheLike, key: string, response: Response): Promise<void> {
  try {
    await cache.put(key, withoutRedirectFlag(response));
  } catch {
    // A full disk or a `Vary: *` header. The response still reached the page.
  }
}

/** Asks the network, and keeps a copy of a good answer. Rejects when the network does. */
async function fetchAndStore(
  request: Request | string,
  cache: CacheLike,
  key: string,
  ctx: Ctx,
  storable: Storable,
): Promise<Response> {
  const response = await ctx.fetch(request);
  if (storable(response)) ctx.waitUntil(store(cache, key, response.clone()));
  return response;
}

export async function cacheFirst(request: Request, route: CacheRoute, ctx: Ctx): Promise<Response> {
  const cache = await ctx.caches.open(route.cache);
  const cached = await cache.match(route.key);
  if (cached) return cached;
  try {
    return await fetchAndStore(request, cache, route.key, ctx, isStorable);
  } catch {
    return Response.error();
  }
}

export async function staleWhileRevalidate(
  request: Request,
  route: CacheRoute,
  ctx: Ctx,
  storable: Storable = isStorable,
): Promise<Response> {
  const cache = await ctx.caches.open(route.cache);
  const match = await cache.match(route.key);
  // A copy that would not be kept today is not served either.
  const cached = match && storable(match) ? match : undefined;
  const fresh = fetchAndStore(request, cache, route.key, ctx, storable);
  if (cached) {
    ctx.waitUntil(fresh.catch(() => undefined));
    return cached;
  }
  try {
    return await fresh;
  } catch {
    return Response.error();
  }
}

/**
 * What the router gets when a payload is neither on the network nor in the cache.
 *
 * Next 16.3 reads the content type before anything else. A payload answer that is not
 * `text/x-component`, or is not ok, makes the router give up on the soft navigation and
 * assign the URL to `location` instead: a full navigation, which `navigate` below can
 * answer from the HTML cache. A prefetch that gets this answer is dropped without noise.
 * A rejected fetch ends in the same place, but logs an error for every link in view.
 */
export function rscMiss(): Response {
  return new Response('Offline. This page is not downloaded as a payload.', {
    status: 503,
    statusText: 'Offline',
    headers: { 'content-type': 'text/plain; charset=utf-8', [OFFLINE_HEADER]: 'rsc' },
  });
}

export async function networkFirst(
  request: Request,
  route: CacheRoute,
  ctx: Ctx,
  timeoutMs: number = NETWORK_TIMEOUT_MS,
): Promise<Response> {
  const cache = await ctx.caches.open(route.cache);
  const fresh = fetchAndStore(request, cache, route.key, ctx, isStorableRsc);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const first = await Promise.race([fresh, timeout]);
    if (first !== 'timeout') return first;
    // The network stalls. A copy answers now; the slow response still refreshes it.
    const cached = await cache.match(route.key);
    if (cached) {
      ctx.waitUntil(fresh.catch(() => undefined));
      return cached;
    }
    return await fresh;
  } catch {
    return (await cache.match(route.key)) ?? rscMiss();
  } finally {
    clearTimeout(timer);
  }
}

/** The last resort, for a worker whose precache never finished. */
function bareOfflinePage(): Response {
  const body =
    '<!doctype html><html lang="en-GB"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline · Understory</title><p>Offline. This page is not on this device yet.</p>';
  return new Response(body, {
    status: 503,
    statusText: 'Offline',
    headers: { 'content-type': 'text/html; charset=utf-8', [OFFLINE_HEADER]: 'page' },
  });
}

export async function navigate(request: Request, route: CacheRoute, ctx: Ctx): Promise<Response> {
  const cache = await ctx.caches.open(route.cache);
  const cached = await cache.match(route.key);
  const fresh = fetchAndStore(request, cache, route.key, ctx, isStorableHtml);
  if (cached) {
    ctx.waitUntil(fresh.catch(() => undefined));
    return cached;
  }
  try {
    return await fresh;
  } catch {
    const pages = await ctx.caches.open(CACHES.pages);
    return (await pages.match(OFFLINE_URL)) ?? bareOfflinePage();
  }
}

export type CacheRoute = Exclude<Route, { strategy: 'bypass' }>;

/** Null means the worker stays out of it and the browser handles the request. */
export function respond(request: Request, route: Route, ctx: Ctx): Promise<Response> | null {
  switch (route.strategy) {
    case 'bypass':
      return null;
    case 'cache-first':
      return cacheFirst(request, route, ctx);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request, route, ctx, storableFor(route.key));
    case 'network-first':
      return networkFirst(request, route, ctx);
    case 'navigate':
      return navigate(request, route, ctx);
  }
}
