import { CACHES } from './config';
import { classify } from './routing';
import { isStorableHtml, storableFor, withoutRedirectFlag } from './strategies';
import type { Env } from './types';

/*
 * Putting things into the caches on purpose: at install, when the page reports what it
 * loaded before the worker had control, and when the learner downloads the course.
 * Every function here tolerates single failures. Half a precache beats no worker.
 */

const ASSET_REFERENCE = /\/_next\/static\/[A-Za-z0-9_.~%@()[\]/-]+/g;

/** The build files an HTML document points at: scripts, styles, fonts. */
export function extractAssetUrls(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(ASSET_REFERENCE)) found.add(match[0]);
  return [...found];
}

/** Runs `work` over `items`, a few at a time, so a download does not starve the page. */
export async function eachLimited<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next++] as T;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

export interface CollectOptions {
  /** Ask the server again even when a copy exists. Pages and index files change; hashed files do not. */
  refresh?: boolean;
}

/**
 * Fetches one same-origin file and files it where the routing table will look for it.
 */
export async function collectFile(
  env: Env,
  path: string,
  options: CollectOptions = {},
): Promise<boolean> {
  const url = new URL(path, env.origin);
  const route = classify({ method: 'GET', url: url.href, headers: new Headers() }, env.origin);
  if (route.strategy === 'bypass' || route.strategy === 'network-first') return false;

  const cache = await env.caches.open(route.cache);
  const immutable = route.strategy === 'cache-first';
  if ((immutable || !options.refresh) && (await cache.match(route.key))) return true;

  try {
    const response = await env.fetch(url.href, {
      credentials: 'same-origin',
      cache: immutable ? 'default' : 'no-cache',
    });
    if (!storableFor(route.key)(response)) return false;
    await cache.put(route.key, withoutRedirectFlag(response));
    return true;
  } catch {
    return false;
  }
}

/** Fetches an HTML document into the pages cache, then the build files it points at. */
export async function collectPage(
  env: Env,
  path: string,
  options: CollectOptions = {},
): Promise<boolean> {
  const url = new URL(path, env.origin);
  if (url.origin !== env.origin) return false;
  const key = url.pathname;
  const pages = await env.caches.open(CACHES.pages);

  let html: string;
  const cached = options.refresh ? undefined : await pages.match(key);
  if (cached) {
    html = await cached.text();
  } else {
    try {
      const response = await env.fetch(url.href, {
        credentials: 'same-origin',
        cache: 'no-cache',
        headers: { accept: 'text/html' },
      });
      if (!isStorableHtml(response)) return false;
      const copy = withoutRedirectFlag(response);
      html = await copy.clone().text();
      await pages.put(key, copy);
    } catch {
      return false;
    }
  }

  await eachLimited(extractAssetUrls(html), 6, async (asset) => {
    await collectFile(env, asset);
  });
  return true;
}

/** `/learn/javascript/closures` is a page; `/content/v1/lessons/x.json` is a file. */
export function isPagePath(path: string, origin: string): boolean {
  const route = classify(
    { method: 'GET', url: new URL(path, origin).href, headers: new Headers() },
    origin,
  );
  return route.strategy === 'bypass' && route.reason === 'unmatched';
}

export function collect(env: Env, path: string, options: CollectOptions = {}): Promise<boolean> {
  return isPagePath(path, env.origin)
    ? collectPage(env, path, options)
    : collectFile(env, path, options);
}
