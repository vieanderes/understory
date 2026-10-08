/*
 * Names and lists. To throw a cache away on every device, raise its version here
 * (docs/OFFLINE.md, "Bumping a cache version"): activate deletes every `understory-*`
 * cache whose name is not in CACHE_NAMES.
 */

declare const __SW_BUILD_ID__: string | undefined;
declare const __SW_ASSETS__: readonly string[] | undefined;

/** Injected by scripts/build-sw.ts. A new deploy changes it, so the browser installs a new worker. */
export const BUILD_ID: string = typeof __SW_BUILD_ID__ === 'string' ? __SW_BUILD_ID__ : 'dev';

/** Every file under `/_next/static` in this build, injected by scripts/build-sw.ts. */
export const BUILD_ASSETS: readonly string[] =
  typeof __SW_ASSETS__ === 'undefined' ? [] : __SW_ASSETS__;

export const CACHE_PREFIX = 'understory-';

export const CACHES = {
  /** Build output, fonts, icons, the sandbox runner. */
  static: 'understory-static-v1',
  /** The course: manifest, catalog, lesson and solution files. */
  content: 'understory-content-v1',
  /** HTML documents and React Server Component payloads. */
  pages: 'understory-pages-v1',
  /**
   * Pyodide, about 13 MB, kept after the first Python run and never precached: most
   * learners never run Python. Its own cache, because the static cache is pruned to the
   * current build's files on every activate. The wheels of numpy, pandas and pydantic
   * (10 MB for all three) join it on the first run that imports each.
   */
  python: 'understory-python-v2',
  /**
   * The TypeScript checker worker, about 1 MB compressed, kept after the first TypeScript
   * challenge and never precached, for the same reasons as Python.
   */
  typescript: 'understory-typescript-v1',
  /**
   * Postgres for sql steps (PGlite), about 5.6 MB compressed, kept after the first sql step
   * and never precached, for the same reasons as Python.
   */
  sql: 'understory-sql-v1',
} as const;

export const CACHE_NAMES: readonly string[] = Object.values(CACHES);

export const OFFLINE_URL = '/offline';

/** The places of the app shell, and the four session lengths. Lessons are cached on visit or download. */
export const SHELL_ROUTES: readonly string[] = [
  '/',
  '/learn',
  '/practise',
  '/progress',
  '/signal',
  '/settings',
  '/decisions',
  '/vocabulary',
  '/vocabulary/review',
  '/practise/session/5',
  '/practise/session/10',
  '/practise/session/20',
  '/practise/session/45',
];

export const PRECACHE_FILES: readonly string[] = [
  '/sandbox/runner.v1.html',
  '/sandbox/harness.v1.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icon.svg',
  '/apple-icon.png',
  '/manifest.webmanifest',
];

export const CONTENT_INDEX_FILES: readonly string[] = [
  '/content/v1/manifest.json',
  '/content/v1/catalog.json',
  '/content/v1/words.json',
];

/** How long network-first waits before it answers from the cache. A tunnel often stalls instead of failing. */
export const NETWORK_TIMEOUT_MS = 3000;

/** Marks a response the worker made up, so the client and the tests can tell. */
export const OFFLINE_HEADER = 'x-understory-offline';
