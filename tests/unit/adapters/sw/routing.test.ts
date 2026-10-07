import { describe, expect, it } from 'vitest';
import { CACHES, PRECACHE_FILES } from '@/sw/config';
import { classify, isRscRequest, rscKey, type RequestInfoLike } from '@/sw/routing';
import type { Route } from '@/sw/routing';
import { ORIGIN } from './fakes';

/** The cache key of a route that is cached. A bypass has none, which fails the test. */
function cacheKey(route: Route): string {
  if (route.strategy === 'bypass')
    throw new Error(`Expected a cached route, got bypass (${route.reason}).`);
  return route.key;
}

/*
 * The routing table (src/sw/routing.ts). One pure function, so the whole table is a
 * table here too. The order of the rules is part of what is being asserted: a rule that
 * moves above the safety rules would let the worker answer an API call.
 */

function req(
  path: string,
  extra: {
    headers?: Record<string, string>;
    mode?: string;
    destination?: string;
    method?: string;
  } = {},
): RequestInfoLike {
  return {
    method: extra.method ?? 'GET',
    url: path.startsWith('http') ? path : `${ORIGIN}${path}`,
    ...(extra.mode === undefined ? {} : { mode: extra.mode }),
    ...(extra.destination === undefined ? {} : { destination: extra.destination }),
    headers: new Headers(extra.headers),
  };
}

const page = (path: string): RequestInfoLike => req(path, { mode: 'navigate' });

describe('classify: what the worker refuses to touch', () => {
  it('leaves anything that is not a GET to the browser', () => {
    expect(classify(req('/learn', { method: 'POST', mode: 'navigate' }), ORIGIN)).toEqual({
      strategy: 'bypass',
      reason: 'method',
    });
  });

  it('leaves another origin alone, even for a file it would otherwise cache', () => {
    expect(classify(req('https://cdn.example.com/_next/static/a.js'), ORIGIN)).toEqual({
      strategy: 'bypass',
      reason: 'cross-origin',
    });
  });

  it('never answers or stores an API call', () => {
    expect(classify(req('/api'), ORIGIN)).toEqual({ strategy: 'bypass', reason: 'api' });
    expect(classify(req('/api/health'), ORIGIN)).toEqual({ strategy: 'bypass', reason: 'api' });
  });

  it('does not cache itself', () => {
    expect(classify(req('/sw.js'), ORIGIN)).toEqual({ strategy: 'bypass', reason: 'worker' });
  });

  it('stays out of a same-origin sub-resource it has no rule for', () => {
    expect(classify(req('/data/news/2026/09/17.json'), ORIGIN)).toEqual({
      strategy: 'bypass',
      reason: 'unmatched',
    });
  });

  it('is not fooled by a path that only looks like an API call', () => {
    expect(classify(page('/apiary'), ORIGIN).strategy).toBe('navigate');
  });
});

describe('classify: cache-first for names that carry a hash', () => {
  it.each([
    ['/_next/static/chunks/main-8f3a.js', CACHES.static],
    ['/_next/static/css/app-1c2d.css', CACHES.static],
    ['/fonts/geist-latin.woff2', CACHES.static],
    ['/content/v1/lessons/js.closures.ab12.json', CACHES.content],
    ['/content/v1/solutions/js.closures.ab12.json', CACHES.content],
  ])('%s is answered from the cache', (path, cache) => {
    expect(classify(req(path), ORIGIN)).toEqual({ strategy: 'cache-first', cache, key: path });
  });

  it('keys a build file by its path, so a deployment query does not split the cache', () => {
    expect(classify(req('/_next/static/chunks/main-8f3a.js?dpl=abc'), ORIGIN)).toMatchObject({
      key: '/_next/static/chunks/main-8f3a.js',
    });
  });
});

describe('classify: stale-while-revalidate for the short-lived files', () => {
  it.each([
    ['/content/v1/manifest.json', CACHES.content],
    ['/content/v1/catalog.json', CACHES.content],
    ['/manifest.webmanifest', CACHES.static],
    ['/icon.svg', CACHES.static],
    ['/apple-icon.png', CACHES.static],
    ['/icons/icon-192.png', CACHES.static],
  ])('%s is answered at once and refreshed behind it', (path, cache) => {
    expect(classify(req(path), ORIGIN)).toEqual({
      strategy: 'stale-while-revalidate',
      cache,
      key: path,
    });
  });

  it('takes the sandbox runner before the navigation rule, so it never gets the offline page', () => {
    expect(classify(page('/sandbox/runner.v1.html'), ORIGIN)).toEqual({
      strategy: 'stale-while-revalidate',
      cache: CACHES.static,
      key: '/sandbox/runner.v1.html',
    });
    expect(classify(req('/sandbox/harness.v1.js'), ORIGIN).strategy).toBe('stale-while-revalidate');
  });
});

describe('classify: Pyodide', () => {
  it('keeps the Pyodide files on first use, in their own cache, never precached', () => {
    expect(classify(req('/pyodide/0.29.5/pyodide.asm.wasm'), ORIGIN)).toEqual({
      strategy: 'cache-first',
      cache: CACHES.python,
      key: '/pyodide/0.29.5/pyodide.asm.wasm',
    });
    expect(PRECACHE_FILES.some((file) => file.startsWith('/pyodide/'))).toBe(false);
  });

  it('keeps a package wheel beside them, in the same cache, after its first use', () => {
    const wheel = '/pyodide/0.29.5/numpy-2.2.5-cp313-cp313-pyemscripten_2025_0_wasm32.whl';
    expect(classify(req(wheel), ORIGIN)).toEqual({
      strategy: 'cache-first',
      cache: CACHES.python,
      key: wheel,
    });
  });
});

describe('classify: the type checker', () => {
  it('keeps the hashed worker on first use, in its own cache, never precached', () => {
    expect(classify(req('/typescript/checker.0123456789abcdef.js'), ORIGIN)).toEqual({
      strategy: 'cache-first',
      cache: CACHES.typescript,
      key: '/typescript/checker.0123456789abcdef.js',
    });
    expect(PRECACHE_FILES.some((file) => file.startsWith('/typescript/'))).toBe(false);
  });

  it('revalidates the manifest that names it, so a new build reaches the learner', () => {
    expect(classify(req('/typescript/checker.json'), ORIGIN)).toEqual({
      strategy: 'stale-while-revalidate',
      cache: CACHES.static,
      key: '/typescript/checker.json',
    });
  });

  it('leaves any other path under /typescript/ to the network', () => {
    expect(classify(req('/typescript/other.js'), ORIGIN).strategy).toBe('bypass');
  });
});

describe('classify: the SQL engine', () => {
  it('keeps Postgres and the worker on first use, in their own cache, never precached', () => {
    for (const file of [
      'pglite.wasm',
      'pglite.data',
      'initdb.wasm',
      'engine.0123456789abcdef.js',
    ]) {
      expect(classify(req(`/sql/0.5.8/${file}`), ORIGIN)).toEqual({
        strategy: 'cache-first',
        cache: CACHES.sql,
        key: `/sql/0.5.8/${file}`,
      });
    }
    expect(PRECACHE_FILES.some((file) => file.startsWith('/sql/'))).toBe(false);
  });

  it('revalidates the manifest that names the worker', () => {
    expect(classify(req('/sql/engine.json'), ORIGIN)).toEqual({
      strategy: 'stale-while-revalidate',
      cache: CACHES.static,
      key: '/sql/engine.json',
    });
  });

  it('leaves any other path under /sql/ to the network', () => {
    expect(classify(req('/sql/other.js'), ORIGIN).strategy).toBe('bypass');
    expect(classify(req('/sql/latest/pglite.wasm'), ORIGIN).strategy).toBe('bypass');
  });
});

describe('classify: documents', () => {
  it('treats a navigation as a document', () => {
    expect(classify(page('/learn/javascript/closures'), ORIGIN)).toEqual({
      strategy: 'navigate',
      cache: CACHES.pages,
      key: '/learn/javascript/closures',
    });
  });

  it('treats an iframe or a prerender with destination document the same way', () => {
    expect(classify(req('/settings', { destination: 'document' }), ORIGIN).strategy).toBe(
      'navigate',
    );
  });

  it('drops the query and the fragment: every page is static', () => {
    expect(cacheKey(classify(page('/learn/javascript/closures?from=map#step-3'), ORIGIN))).toBe(
      '/learn/javascript/closures',
    );
  });
});

describe('classify: React Server Component payloads', () => {
  it('recognises a payload by its header and by its query', () => {
    expect(isRscRequest(req('/learn', { headers: { rsc: '1' } }), new URL(`${ORIGIN}/learn`))).toBe(
      true,
    );
    const url = new URL(`${ORIGIN}/learn?_rsc=1a2b3c`);
    expect(isRscRequest(req('/learn?_rsc=1a2b3c'), url)).toBe(true);
    expect(isRscRequest(req('/learn'), new URL(`${ORIGIN}/learn`))).toBe(false);
  });

  it('asks the network first and keeps the copy in the pages cache', () => {
    const route = classify(req('/learn?_rsc=1a2b3c', { headers: { rsc: '1' } }), ORIGIN);
    expect(route).toMatchObject({ strategy: 'network-first', cache: CACHES.pages });
  });

  it('takes the payload rule before the navigation rule', () => {
    // Next sends `rsc: 1` with mode navigate for a prefetch of a page it may soft-navigate to.
    const route = classify(
      req('/map?_rsc=zz', { headers: { rsc: '1' }, mode: 'navigate' }),
      ORIGIN,
    );
    expect(route.strategy).toBe('network-first');
  });
});

describe('rscKey', () => {
  const url = (search: string): URL => new URL(`${ORIGIN}/learn${search}`);

  it('keys a segment prefetch by path and segment, so the hash cannot split it', () => {
    const headers = { rsc: '1', 'next-router-segment-prefetch': '/_tree' };
    const first = rscKey(req('/learn?_rsc=aaaa', { headers }), url('?_rsc=aaaa'));
    const second = rscKey(req('/learn?_rsc=bbbb', { headers }), url('?_rsc=bbbb'));
    expect(first).toBe(second);
    expect(first).toBe('/learn?__segment=%2F_tree');
  });

  it('keeps one key per segment', () => {
    const tree = rscKey(
      req('/learn?_rsc=aaaa', { headers: { 'next-router-segment-prefetch': '/_tree' } }),
      url('?_rsc=aaaa'),
    );
    const full = rscKey(
      req('/learn?_rsc=aaaa', { headers: { 'next-router-segment-prefetch': '/' } }),
      url('?_rsc=aaaa'),
    );
    expect(tree).not.toBe(full);
  });

  it('keeps the hash for a navigation payload: it is a patch against one router state', () => {
    const key = rscKey(req('/learn?_rsc=aaaa', { headers: { rsc: '1' } }), url('?_rsc=aaaa'));
    expect(key).toBe('/learn?_rsc=aaaa&__payload=navigation');
    const other = rscKey(req('/learn?_rsc=bbbb', { headers: { rsc: '1' } }), url('?_rsc=bbbb'));
    expect(other).not.toBe(key);
  });
});
