import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FetchLike } from '../../../../scripts/news/http';

/** Recorded on 2026-09-17. The tests pin the clock to the same morning. */
export const NOW = new Date('2026-09-17T10:30:00Z');
export const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

export function fixture(name: string): Promise<string> {
  return readFile(path.join(import.meta.dirname, 'fixtures', name), 'utf8');
}

export interface Route {
  match: (url: string) => boolean;
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

export interface FakeFetch {
  fetch: FetchLike;
  calls: { url: string; init?: RequestInit }[];
}

/** A fetch that never leaves the process. An unrouted URL fails the test loudly. */
export function fakeFetch(routes: readonly Route[]): FakeFetch {
  const calls: FakeFetch['calls'] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, ...(init !== undefined && { init }) });
      const route = routes.find((candidate) => candidate.match(url));
      if (route === undefined) throw new Error(`Unexpected request to ${url}`);
      return route.respond(url, init);
    },
  };
}

export const ok = (body: string): Response => new Response(body, { status: 200 });
export const status = (code: number): Response => new Response('', { status: code });
export const hostIs = (host: string) => (url: string) => new URL(url).host === host;

/** Records the pauses instead of waiting for them. */
export function fakeSleep(): { sleep: (ms: number) => Promise<void>; pauses: number[] } {
  const pauses: number[] = [];
  return {
    pauses,
    sleep: (ms) => {
      pauses.push(ms);
      return Promise.resolve();
    },
  };
}
