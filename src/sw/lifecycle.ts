import { collect, eachLimited } from './collect';
import {
  BUILD_ASSETS,
  CACHE_NAMES,
  CACHE_PREFIX,
  CACHES,
  CONTENT_INDEX_FILES,
  OFFLINE_URL,
  PRECACHE_FILES,
  SHELL_ROUTES,
} from './config';
import type { Env } from './types';

/**
 * Install: the offline page first, then the shell, the runner, the install files, the
 * course index and this build's files. One failure does not fail the install; whatever
 * is missing is cached later, on first use.
 */
export async function precache(env: Env): Promise<{ stored: number; failed: string[] }> {
  const failed: string[] = [];
  let stored = 0;
  const paths = [
    OFFLINE_URL,
    ...SHELL_ROUTES,
    ...PRECACHE_FILES,
    ...CONTENT_INDEX_FILES,
    ...BUILD_ASSETS,
  ];
  await eachLimited(paths, 6, async (path) => {
    if (await collect(env, path, { refresh: true })) stored += 1;
    else failed.push(path);
  });
  return { stored, failed };
}

/** Activate: caches of an older version go. Other sites' and other apps' caches are not ours to touch. */
export async function deleteOldCaches(env: Env): Promise<string[]> {
  const names = await env.caches.keys();
  const old = names.filter((name) => name.startsWith(CACHE_PREFIX) && !CACHE_NAMES.includes(name));
  await Promise.all(old.map((name) => env.caches.delete(name)));
  return old;
}

/**
 * A new build leaves the old build's files behind. They are dropped once every cached
 * document has been fetched again and so points at the new files. If one refresh fails,
 * nothing is dropped: an old page with its old scripts still works offline.
 */
export async function pruneOldBuild(
  env: Env,
  assets: readonly string[] = BUILD_ASSETS,
): Promise<number> {
  if (assets.length === 0) return 0;
  const keep = new Set(assets);
  const files = await env.caches.open(CACHES.static);
  const stale = (await files.keys())
    .map((request) => new URL(request.url, env.origin).pathname)
    .filter((path) => path.startsWith('/_next/static/') && !keep.has(path));
  if (stale.length === 0) return 0;

  const pages = await env.caches.open(CACHES.pages);
  const keys = (await pages.keys()).map((request) => new URL(request.url, env.origin));
  const documents = keys.filter((url) => url.search === '').map((url) => url.pathname);
  const payloads = keys.filter((url) => url.search !== '');

  let refreshed = true;
  await eachLimited(documents, 4, async (path) => {
    if (!(await collect(env, path, { refresh: true }))) refreshed = false;
  });
  if (!refreshed) return 0;

  // Payloads of the old build carry its build id; the router would refuse them anyway.
  await Promise.all(payloads.map((url) => pages.delete(`${url.pathname}${url.search}`)));
  await Promise.all(stale.map((path) => files.delete(path)));
  return stale.length;
}
