import { describe, expect, it, vi } from 'vitest';
import { CACHES, OFFLINE_HEADER, OFFLINE_URL } from '@/sw/config';
import type { CacheRoute } from '@/sw/strategies';
import {
  cacheFirst,
  isStorable,
  isStorableHtml,
  isStorableRsc,
  isStorableSandboxDocument,
  navigate,
  networkFirst,
  respond,
  rscMiss,
  staleWhileRevalidate,
  storableFor,
  withoutRedirectFlag,
} from '@/sw/strategies';
import { html, makeCtx, never, offline, ok, ORIGIN, rsc, runnerDocument } from './fakes';

/*
 * Each caching strategy against fake caches and a fake network. The interesting cases
 * are the offline ones: every strategy has to end somewhere useful with no network.
 */

const request = (path: string): Request => new Request(`${ORIGIN}${path}`);

const route = (strategy: CacheRoute['strategy'], cache: string, key: string): CacheRoute =>
  ({ strategy, cache, key }) as CacheRoute;

describe('what may be stored', () => {
  it('keeps a complete same-origin answer and nothing else', async () => {
    expect(isStorable(new Response('x', { status: 200 }))).toBe(true);
    expect(isStorable(new Response('x', { status: 404 }))).toBe(false);
    expect(isStorable(new Response(null, { status: 204 }))).toBe(false);
  });

  it('checks the content type where the content type is the whole point', () => {
    expect(isStorableHtml(html('<p>hello'))).toBe(true);
    expect(isStorableHtml(ok('{}', 'application/json'))).toBe(false);
    expect(isStorableRsc(rsc('0:["x"]'))).toBe(true);
    expect(isStorableRsc(html('<p>hello'))).toBe(false);
  });

  it('strips the redirected flag but keeps the headers a sandbox depends on', async () => {
    const original = ok('<p>runner', 'text/html');
    original.headers.set('content-security-policy', 'sandbox allow-scripts');
    Object.defineProperty(original, 'redirected', { value: true });
    const copy = withoutRedirectFlag(original);
    expect(copy.redirected).toBe(false);
    expect(copy.headers.get('content-security-policy')).toBe('sandbox allow-scripts');
    expect(await copy.text()).toBe('<p>runner');
  });

  it('leaves a response that never followed a redirect untouched', () => {
    const original = html('<p>x');
    expect(withoutRedirectFlag(original)).toBe(original);
  });
});

describe('cache-first', () => {
  const where = route('cache-first', CACHES.static, '/_next/static/main.js');

  it('answers from the cache without asking the network', async () => {
    const fetch = vi.fn(async () => ok('fresh', 'text/javascript'));
    const ctx = makeCtx(fetch);
    await (await ctx.caches.open(CACHES.static)).put(where.key, ok('kept', 'text/javascript'));

    const response = await cacheFirst(request('/_next/static/main.js'), where, ctx);
    expect(await response.text()).toBe('kept');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches once on a miss and keeps the answer', async () => {
    const ctx = makeCtx(async () => ok('fresh', 'text/javascript'));
    const response = await cacheFirst(request('/_next/static/main.js'), where, ctx);
    expect(await response.text()).toBe('fresh');
    await ctx.settle();
    expect(await ctx.caches.peek(CACHES.static)?.text(where.key)).toBe('fresh');
  });

  it('does not keep a 404', async () => {
    const ctx = makeCtx(async () => new Response('gone', { status: 404 }));
    await cacheFirst(request('/_next/static/main.js'), where, ctx);
    await ctx.settle();
    expect(ctx.caches.peek(CACHES.static)?.entries.size).toBe(0);
  });

  it('gives a network error back when there is nothing cached and no network', async () => {
    const ctx = makeCtx(offline);
    const response = await cacheFirst(request('/_next/static/main.js'), where, ctx);
    expect(response.type).toBe('error');
  });
});

describe('stale-while-revalidate', () => {
  const where = route('stale-while-revalidate', CACHES.content, '/content/v1/catalog.json');

  it('answers with the copy at once and refreshes it behind the answer', async () => {
    const fetch = vi.fn(async () => ok('{"v":2}', 'application/json'));
    const ctx = makeCtx(fetch);
    await (await ctx.caches.open(CACHES.content)).put(where.key, ok('{"v":1}', 'application/json'));

    const response = await staleWhileRevalidate(request('/content/v1/catalog.json'), where, ctx);
    expect(await response.text()).toBe('{"v":1}');
    expect(fetch).toHaveBeenCalledTimes(1);
    await ctx.settle();
    expect(await ctx.caches.peek(CACHES.content)?.text(where.key)).toBe('{"v":2}');
  });

  it('waits for the network on a miss, and keeps what it gets', async () => {
    const ctx = makeCtx(async () => ok('{"v":1}', 'application/json'));
    const response = await staleWhileRevalidate(request('/content/v1/catalog.json'), where, ctx);
    expect(await response.text()).toBe('{"v":1}');
    await ctx.settle();
    expect(await ctx.caches.peek(CACHES.content)?.text(where.key)).toBe('{"v":1}');
  });

  it('still answers from the copy when the refresh fails offline', async () => {
    const ctx = makeCtx(offline);
    await (await ctx.caches.open(CACHES.content)).put(where.key, ok('{"v":1}', 'application/json'));
    const response = await staleWhileRevalidate(request('/content/v1/catalog.json'), where, ctx);
    expect(await response.text()).toBe('{"v":1}');
    await expect(ctx.settle()).resolves.toBeUndefined();
  });

  it('gives a network error back on a miss with no network', async () => {
    const ctx = makeCtx(offline);
    const response = await staleWhileRevalidate(request('/content/v1/catalog.json'), where, ctx);
    expect(response.type).toBe('error');
  });
});

describe('network-first, for payloads', () => {
  const where = route('network-first', CACHES.pages, '/learn?_rsc=aaaa&__payload=navigation');

  it('prefers the network and keeps a payload', async () => {
    const ctx = makeCtx(async () => rsc('0:["fresh"]'));
    const response = await networkFirst(request('/learn?_rsc=aaaa'), where, ctx);
    expect(await response.text()).toBe('0:["fresh"]');
    await ctx.settle();
    expect(await ctx.caches.peek(CACHES.pages)?.text(where.key)).toBe('0:["fresh"]');
  });

  it('refuses to keep an answer that is not a payload', async () => {
    // A captive portal answering every request with its own HTML is the case that matters.
    const ctx = makeCtx(async () => html('<h1>Sign in to this network'));
    await networkFirst(request('/learn?_rsc=aaaa'), where, ctx);
    await ctx.settle();
    expect(ctx.caches.peek(CACHES.pages)?.entries.size).toBe(0);
  });

  it('falls back to the cached payload when the network fails', async () => {
    const ctx = makeCtx(offline);
    await (await ctx.caches.open(CACHES.pages)).put(where.key, rsc('0:["kept"]'));
    const response = await networkFirst(request('/learn?_rsc=aaaa'), where, ctx);
    expect(await response.text()).toBe('0:["kept"]');
  });

  it('answers from the copy when the network stalls, rather than holding the router', async () => {
    const ctx = makeCtx(never);
    await (await ctx.caches.open(CACHES.pages)).put(where.key, rsc('0:["kept"]'));
    const response = await networkFirst(request('/learn?_rsc=aaaa'), where, ctx, 10);
    expect(await response.text()).toBe('0:["kept"]');
  });

  it('waits out a slow network when there is no copy', async () => {
    const ctx = makeCtx(
      async () =>
        new Promise<Response>((resolve) => setTimeout(() => resolve(rsc('0:["late"]')), 30)),
    );
    const response = await networkFirst(request('/learn?_rsc=aaaa'), where, ctx, 10);
    expect(await response.text()).toBe('0:["late"]');
  });

  it('answers a miss with a 503 the router can act on, not a rejected fetch', async () => {
    const ctx = makeCtx(offline);
    const response = await networkFirst(request('/learn?_rsc=aaaa'), where, ctx);
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get(OFFLINE_HEADER)).toBe('rsc');
  });

  it('marks the made-up answer so the tests and the client can tell', async () => {
    const miss = rscMiss();
    expect(miss.ok).toBe(false);
    expect(miss.headers.get('content-type')).not.toContain('text/x-component');
  });
});

describe('navigate, for documents', () => {
  const where = route('navigate', CACHES.pages, '/learn/javascript/closures');

  it('answers with the page on this device and refreshes it behind the answer', async () => {
    const ctx = makeCtx(async () => html('<h1>new'));
    await (await ctx.caches.open(CACHES.pages)).put(where.key, html('<h1>kept'));
    const response = await navigate(request('/learn/javascript/closures'), where, ctx);
    expect(await response.text()).toBe('<h1>kept');
    await ctx.settle();
    expect(await ctx.caches.peek(CACHES.pages)?.text(where.key)).toBe('<h1>new');
  });

  it('keeps only HTML, so a JSON error page does not become the lesson', async () => {
    const ctx = makeCtx(async () => ok('{"error":"nope"}', 'application/json'));
    await navigate(request('/learn/javascript/closures'), where, ctx);
    await ctx.settle();
    expect(ctx.caches.peek(CACHES.pages)?.entries.size).toBe(0);
  });

  it('serves the offline page for a page that was never on this device', async () => {
    const ctx = makeCtx(offline);
    await (await ctx.caches.open(CACHES.pages)).put(OFFLINE_URL, html('<h1>Offline page'));
    const response = await navigate(request('/learn/javascript/closures'), where, ctx);
    expect(await response.text()).toBe('<h1>Offline page');
  });

  it('makes its own page when even the precache never finished', async () => {
    const ctx = makeCtx(offline);
    const response = await navigate(request('/learn/javascript/closures'), where, ctx);
    expect(response.status).toBe(503);
    expect(response.headers.get(OFFLINE_HEADER)).toBe('page');
    expect(await response.text()).toContain('not on this device yet');
  });
});

describe('the sandbox runner document', () => {
  const RUNNER = '/sandbox/runner.v1.html';
  const where = route('stale-while-revalidate', CACHES.static, RUNNER);

  it('is kept only with the sandbox directive in its CSP, and nothing more allowed', () => {
    expect(isStorableSandboxDocument(runnerDocument('<p>runner'))).toBe(true);
    expect(isStorableSandboxDocument(runnerDocument('<p>runner', null))).toBe(false);
    expect(isStorableSandboxDocument(runnerDocument('<p>runner', "default-src 'none'"))).toBe(
      false,
    );
    expect(
      isStorableSandboxDocument(
        runnerDocument('<p>runner', 'sandbox allow-scripts allow-same-origin'),
      ),
    ).toBe(false);
  });

  it('gets the strict rule by its key; other sandbox files keep the plain one', () => {
    expect(storableFor(RUNNER)).toBe(isStorableSandboxDocument);
    expect(storableFor('/sandbox/react-runtime.v1.js')).toBe(isStorable);
    expect(storableFor('/content/v1/catalog.json')).toBe(isStorable);
  });

  it('answers the frame from the cache with the network cut, headers and all', async () => {
    const ctx = makeCtx(offline);
    await (await ctx.caches.open(CACHES.static)).put(RUNNER, runnerDocument('<p>runner'));
    const response = await respond(request(RUNNER), where, ctx);
    expect(await response?.text()).toBe('<p>runner');
    expect(response?.headers.get('content-security-policy')).toContain('sandbox allow-scripts');
  });

  it('never keeps a copy whose header was stripped on the way', async () => {
    const ctx = makeCtx(async () => runnerDocument('<p>stripped', null));
    const response = await respond(request(RUNNER), where, ctx);
    expect(await response?.text()).toBe('<p>stripped');
    await ctx.settle();
    expect(ctx.caches.peek(CACHES.static)?.entries.has(RUNNER) ?? false).toBe(false);
  });

  it('never serves a copy without the directive, even one already in the cache', async () => {
    const ctx = makeCtx(offline);
    await (await ctx.caches.open(CACHES.static)).put(RUNNER, runnerDocument('<p>old', null));
    const response = await respond(request(RUNNER), where, ctx);
    expect(response?.type).toBe('error');
  });
});

describe('respond', () => {
  it('stays out of a bypassed request so the browser handles it', () => {
    const ctx = makeCtx(offline);
    expect(respond(request('/api/health'), { strategy: 'bypass', reason: 'api' }, ctx)).toBeNull();
  });

  it('sends each strategy to its own handler', async () => {
    const ctx = makeCtx(async () => ok('body', 'text/plain'));
    const answered = respond(
      request('/_next/static/main.js'),
      route('cache-first', CACHES.static, '/_next/static/main.js'),
      ctx,
    );
    expect(answered).not.toBeNull();
    expect(await (await answered)?.text()).toBe('body');
  });
});
