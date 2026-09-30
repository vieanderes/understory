import { collect, eachLimited } from './collect';
import type { WorkerMessage } from './messages';
import type { Env } from './types';

/*
 * "Download for offline". The page sends the list (lesson files, solution files, lesson
 * pages); the worker fetches them a few at a time and reports after each one. A download
 * can be cancelled between files. What was fetched by then stays: it is all usable.
 */

const cancelled = new Set<string>();

export function cancelDownload(id: string): void {
  cancelled.add(id);
}

export async function downloadCourse(
  env: Env,
  id: string,
  urls: readonly string[],
  report: (message: WorkerMessage) => void,
): Promise<void> {
  // Only this origin's paths. A message cannot make the worker fetch anything else.
  const paths = [...new Set(urls)].filter((url) => {
    try {
      return new URL(url, env.origin).origin === env.origin;
    } catch {
      return false;
    }
  });
  const total = paths.length;
  let done = 0;
  let failed = 0;

  await eachLimited(paths, 4, async (path) => {
    if (cancelled.has(id)) return;
    // Pages are asked for again, so a download also brings an old copy up to date.
    if (await collect(env, path, { refresh: true })) done += 1;
    else failed += 1;
    report({ type: 'DOWNLOAD_PROGRESS', id, done, failed, total });
  });

  report({ type: 'DOWNLOAD_DONE', id, done, failed, total, cancelled: cancelled.delete(id) });
}

/** The first visit: the page loaded before the worker had control, so it names what it loaded. */
export async function warm(env: Env, urls: readonly string[]): Promise<number> {
  let stored = 0;
  await eachLimited([...new Set(urls)], 6, async (url) => {
    try {
      const target = new URL(url, env.origin);
      if (target.origin !== env.origin || target.searchParams.has('_rsc')) return;
      if (await collect(env, target.pathname)) stored += 1;
    } catch {
      // Not a URL. Nothing to keep.
    }
  });
  return stored;
}
