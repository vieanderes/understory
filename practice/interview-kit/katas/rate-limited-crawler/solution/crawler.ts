import type { PageResult } from '../fixtures/fake-site';

export interface CrawlOptions {
  startUrl: string;
  fetchPage: (url: string) => Promise<PageResult>;
  maxConcurrency: number;
  maxDepth: number;
  perHostIntervalMs: number;
  allowedHosts?: string[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface CrawledPage {
  url: string;
  depth: number;
  status: number;
}

export interface CrawlError {
  url: string;
  message: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  errors: CrawlError[];
}

interface Job {
  url: string;
  depth: number;
}

function normalise(link: string, base: string): string | undefined {
  try {
    const url = new URL(link, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

const timeoutSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function crawl({
  startUrl,
  fetchPage,
  maxConcurrency,
  maxDepth,
  perHostIntervalMs,
  allowedHosts,
  now = Date.now,
  sleep = timeoutSleep,
}: CrawlOptions): Promise<CrawlResult> {
  const start = normalise(startUrl, startUrl);
  if (!start) return Promise.reject(new TypeError(`Not a crawlable URL: ${startUrl}`));
  const hosts = new Set(allowedHosts ?? [new URL(start).host]);

  const pages: CrawledPage[] = [];
  const errors: CrawlError[] = [];
  // Marked on enqueue, not on fetch, so two pages linking to the same URL cannot both
  // queue it while the first fetch is still in flight.
  const seen = new Set<string>([start]);
  const queue: Job[] = [{ url: start, depth: 0 }];
  let head = 0;
  let active = 0;
  // Per host, the earliest time the next request may start. Reserving the slot before
  // sleeping means two jobs for the same host queue up behind each other correctly.
  const nextSlot = new Map<string, number>();

  return new Promise((resolve) => {
    function enqueueLinks(links: string[], base: string, depth: number): void {
      if (depth > maxDepth) return;
      for (const link of links) {
        const url = normalise(link, base);
        if (!url || seen.has(url) || !hosts.has(new URL(url).host)) continue;
        seen.add(url);
        queue.push({ url, depth });
      }
    }

    async function run(job: Job): Promise<void> {
      const host = new URL(job.url).host;
      const current = now();
      const slot = Math.max(current, nextSlot.get(host) ?? current);
      nextSlot.set(host, slot + perHostIntervalMs);
      if (slot > current) await sleep(slot - current);

      try {
        const result = await fetchPage(job.url);
        if (result.status >= 400) {
          errors.push({ url: job.url, message: `HTTP ${result.status}` });
        } else {
          pages.push({ url: job.url, depth: job.depth, status: result.status });
          enqueueLinks(result.links, job.url, job.depth + 1);
        }
      } catch (error) {
        errors.push({
          url: job.url,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Starts jobs while there is room. Called once at the start and again whenever a job
    // settles; the crawl is over when nothing is queued and nothing is running.
    function pump(): void {
      while (active < maxConcurrency && head < queue.length) {
        const job = queue[head]!;
        head += 1;
        active += 1;
        void run(job).finally(() => {
          active -= 1;
          pump();
        });
      }
      if (active === 0 && head >= queue.length) resolve({ pages, errors });
    }

    pump();
  });
}
