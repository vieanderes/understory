import { describe, expect, it, vi } from 'vitest';
import { collect, eachLimited, extractAssetUrls, isPagePath } from '@/sw/collect';
import { CACHE_PREFIX, CACHES, CONTENT_INDEX_FILES, OFFLINE_URL, SHELL_ROUTES } from '@/sw/config';
import { cancelDownload, downloadCourse, warm } from '@/sw/download';
import { deleteOldCaches, precache, pruneOldBuild } from '@/sw/lifecycle';
import { isClientMessage, type WorkerMessage } from '@/sw/messages';
import { isProtectedPath } from '@/sw/protected';
import type { Env } from '@/sw/types';
import { FakeCaches, ok, ORIGIN, runnerDocument } from './fakes';

/*
 * Install, activate and the two ways the worker is told to fetch something on purpose:
 * the first visit (warm) and "Download for offline".
 */

const PAGE = '<!doctype html><script src="/_next/static/chunks/main-8f3a.js"></script><h1>Lesson';

// Omit first: intersecting two `caches` types would type `open` by the port's CacheLike and
// hide the fake's inspection helpers.
function env(fetch: Env['fetch']): Omit<Env, 'caches'> & { caches: FakeCaches } {
  return { caches: new FakeCaches(), fetch, origin: ORIGIN };
}

const servePages = vi.fn(async (input: Request | string) => {
  const url = String(typeof input === 'string' ? input : input.url);
  if (url.endsWith('.js')) return ok('console.log(1)', 'text/javascript');
  if (url.endsWith('.json')) return ok('{}', 'application/json');
  if (url.endsWith('.png') || url.endsWith('.svg')) return ok('img', 'image/png');
  if (url.endsWith('.webmanifest')) return ok('{}', 'application/manifest+json');
  if (url.includes('/sandbox/')) return runnerDocument('<p>runner');
  return ok(PAGE);
});

describe('what counts as a page', () => {
  it('sorts a route from a file by asking the routing table', () => {
    expect(isPagePath('/learn/javascript/closures', ORIGIN)).toBe(true);
    expect(isPagePath('/', ORIGIN)).toBe(true);
    expect(isPagePath('/content/v1/lessons/a.json', ORIGIN)).toBe(false);
    expect(isPagePath('/_next/static/main.js', ORIGIN)).toBe(false);
  });

  it('finds the build files a document points at', () => {
    expect(
      extractAssetUrls(
        '<link href="/_next/static/css/app-1c2d.css"><script src="/_next/static/chunks/main-8f3a.js">' +
          '<script src="/_next/static/chunks/main-8f3a.js">',
      ),
    ).toEqual(['/_next/static/css/app-1c2d.css', '/_next/static/chunks/main-8f3a.js']);
  });

  it('runs a few at a time and still visits everything', async () => {
    const seen: number[] = [];
    let live = 0;
    let peak = 0;
    await eachLimited([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      live += 1;
      peak = Math.max(peak, live);
      await Promise.resolve();
      seen.push(item);
      live -= 1;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe('collect', () => {
  it('files a page in the pages cache and its build files beside it', async () => {
    const world = env(servePages);
    expect(await collect(world, '/learn/javascript/closures')).toBe(true);
    expect(world.caches.peek(CACHES.pages)?.entries.has('/learn/javascript/closures')).toBe(true);
    expect(world.caches.peek(CACHES.static)?.entries.has('/_next/static/chunks/main-8f3a.js')).toBe(
      true,
    );
  });

  it('does not fetch an immutable file it already holds', async () => {
    const fetch = vi.fn(async () => ok('{}', 'application/json'));
    const world = env(fetch);
    const path = '/content/v1/lessons/a.b12.json';
    await collect(world, path);
    await collect(world, path);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports a failure instead of throwing', async () => {
    const world = env(async () => new Response('nope', { status: 500 }));
    expect(await collect(world, '/learn/javascript/closures')).toBe(false);
    expect(await collect(world, '/content/v1/lessons/a.json')).toBe(false);
  });
});

describe('install', () => {
  it('precaches the offline page, the shell, the runner and the course index', async () => {
    const world = env(servePages);
    const { stored, failed } = await precache(world);
    expect(failed).toEqual([]);
    expect(stored).toBe(
      1 + SHELL_ROUTES.length + CONTENT_INDEX_FILES.length + 8, // 8 install files
    );
    const pages = world.caches.peek(CACHES.pages);
    expect(pages?.entries.has(OFFLINE_URL)).toBe(true);
    for (const route of SHELL_ROUTES) expect(pages?.entries.has(route)).toBe(true);
    expect(world.caches.peek(CACHES.static)?.entries.has('/sandbox/runner.v1.html')).toBe(true);
  });

  it('refuses a runner that arrives without its sandbox header', async () => {
    const world = env(async (input) => {
      const url = String(typeof input === 'string' ? input : input.url);
      if (url.endsWith('/sandbox/runner.v1.html')) return runnerDocument('<p>runner', null);
      return servePages(input);
    });
    const { failed } = await precache(world);
    expect(failed).toEqual(['/sandbox/runner.v1.html']);
    expect(world.caches.peek(CACHES.static)?.entries.has('/sandbox/runner.v1.html')).toBe(false);
  });

  it('installs anyway when one file is missing, and names it', async () => {
    const world = env(async (input) => {
      const url = String(typeof input === 'string' ? input : input.url);
      if (url.endsWith('/apple-icon.png')) return new Response('gone', { status: 404 });
      return servePages(input);
    });
    const { failed } = await precache(world);
    expect(failed).toEqual(['/apple-icon.png']);
    expect(world.caches.peek(CACHES.pages)?.entries.has(OFFLINE_URL)).toBe(true);
  });
});

describe('activate', () => {
  it('deletes this app caches of an older version and touches nobody else', async () => {
    const world = env(servePages);
    await world.caches.open(CACHES.static);
    await world.caches.open(`${CACHE_PREFIX}static-v0`);
    await world.caches.open('some-other-app-v3');
    expect(await deleteOldCaches(world)).toEqual([`${CACHE_PREFIX}static-v0`]);
    expect(await world.caches.keys()).toEqual([CACHES.static, 'some-other-app-v3']);
  });

  it('drops the old build only once every cached page points at the new one', async () => {
    const world = env(servePages);
    const files = await world.caches.open(CACHES.static);
    await files.put('/_next/static/chunks/main-old.js', ok('old', 'text/javascript'));
    await files.put('/_next/static/chunks/main-8f3a.js', ok('new', 'text/javascript'));
    const pages = await world.caches.open(CACHES.pages);
    await pages.put('/learn/javascript/closures', ok(PAGE));
    await pages.put('/learn?_rsc=aaaa&__payload=navigation', ok('0:[]', 'text/x-component'));

    expect(await pruneOldBuild(world, ['/_next/static/chunks/main-8f3a.js'])).toBe(1);
    expect(files.entries.has('/_next/static/chunks/main-old.js')).toBe(false);
    expect(files.entries.has('/_next/static/chunks/main-8f3a.js')).toBe(true);
    // Payloads of the old build carry its id, so they go with it.
    expect(pages.entries.has('/learn?_rsc=aaaa&__payload=navigation')).toBe(false);
    expect(pages.entries.has('/learn/javascript/closures')).toBe(true);
  });

  it('keeps the old build when a page cannot be fetched again', async () => {
    const world = env(async () => Promise.reject(new TypeError('Failed to fetch')));
    const files = await world.caches.open(CACHES.static);
    await files.put('/_next/static/chunks/main-old.js', ok('old', 'text/javascript'));
    await (await world.caches.open(CACHES.pages)).put('/learn', ok(PAGE));
    expect(await pruneOldBuild(world, ['/_next/static/chunks/main-8f3a.js'])).toBe(0);
    expect(files.entries.has('/_next/static/chunks/main-old.js')).toBe(true);
  });

  it('does nothing when the build has no file list, as in development', async () => {
    expect(await pruneOldBuild(env(servePages), [])).toBe(0);
  });

  it('knows where a reload would cost the learner their place', () => {
    expect(isProtectedPath('/learn/javascript/closures')).toBe(true);
    expect(isProtectedPath('/practise/session/20')).toBe(true);
    expect(isProtectedPath('/learn')).toBe(false);
    expect(isProtectedPath('/map')).toBe(false);
  });
});

describe('download for offline', () => {
  const urls = [
    '/content/v1/lessons/a.b12.json',
    '/learn/javascript/closures',
    '/learn/javascript/closures',
    'https://evil.example.com/steal',
  ];

  it('fetches only this origin, reports after each file and ends with a total', async () => {
    const world = env(servePages);
    const seen: WorkerMessage[] = [];
    await downloadCourse(world, 'd1', urls, (message) => seen.push(message));

    const done = seen.at(-1);
    expect(done).toMatchObject({ type: 'DOWNLOAD_DONE', total: 2, done: 2, failed: 0 });
    expect(seen.filter((m) => m.type === 'DOWNLOAD_PROGRESS')).toHaveLength(2);
    expect(world.caches.peek(CACHES.content)?.entries.size).toBe(1);
  });

  it('counts a file that failed without giving up on the rest', async () => {
    const world = env(async (input) => {
      const url = String(typeof input === 'string' ? input : input.url);
      if (url.includes('lessons')) return new Response('gone', { status: 404 });
      return servePages(input);
    });
    const seen: WorkerMessage[] = [];
    await downloadCourse(world, 'd2', urls, (message) => seen.push(message));
    expect(seen.at(-1)).toMatchObject({ done: 1, failed: 1, cancelled: false });
  });

  it('stops between files when cancelled, and keeps what it has', async () => {
    const world = env(servePages);
    const seen: WorkerMessage[] = [];
    cancelDownload('d3');
    await downloadCourse(world, 'd3', urls, (message) => seen.push(message));
    expect(seen).toEqual([
      { type: 'DOWNLOAD_DONE', id: 'd3', done: 0, failed: 0, total: 2, cancelled: true },
    ]);
  });
});

describe('warm, on the first visit', () => {
  it('keeps this origin pages and files, and skips payloads and other origins', async () => {
    const world = env(servePages);
    const stored = await warm(world, [
      `${ORIGIN}/learn/javascript/closures`,
      `${ORIGIN}/_next/static/chunks/main-8f3a.js`,
      `${ORIGIN}/learn?_rsc=aaaa`,
      'https://fonts.example.com/x.woff2',
      'http://',
    ]);
    expect(stored).toBe(2);
    expect(world.caches.peek(CACHES.pages)?.entries.has('/learn?_rsc=aaaa')).toBe(false);
  });
});

describe('the message API', () => {
  it('accepts only the messages it knows, with the fields it needs', () => {
    expect(isClientMessage({ type: 'SKIP_WAITING' })).toBe(true);
    expect(isClientMessage({ type: 'GET_BUILD_ID' })).toBe(true);
    expect(isClientMessage({ type: 'WARM', urls: ['/a'] })).toBe(true);
    expect(isClientMessage({ type: 'DOWNLOAD_COURSE', id: 'd', urls: ['/a'] })).toBe(true);
    expect(isClientMessage({ type: 'DOWNLOAD_COURSE', id: 'd', urls: [1] })).toBe(false);
    expect(isClientMessage({ type: 'CANCEL_DOWNLOAD' })).toBe(false);
    expect(isClientMessage({ type: 'EVAL', code: 'x' })).toBe(false);
    expect(isClientMessage(null)).toBe(false);
    expect(isClientMessage('SKIP_WAITING')).toBe(false);
  });
});
