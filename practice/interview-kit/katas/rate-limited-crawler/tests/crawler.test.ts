import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSite, type FakePage } from '../fixtures/fake-site';
import { crawl, type CrawlOptions } from '../src/crawler';

const A = 'https://a.test';
const B = 'https://b.test';

async function run(pages: Record<string, FakePage>, options: Partial<CrawlOptions> = {}) {
  const site = createFakeSite(pages);
  const promise = crawl({
    startUrl: `${A}/`,
    fetchPage: site.fetchPage,
    maxConcurrency: 4,
    maxDepth: 10,
    perHostIntervalMs: 0,
    ...options,
  });
  // Mark the rejection as handled while timers run; the await below still throws it.
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  const result = await promise;
  return { site, result, urls: result.pages.map((p) => p.url).sort() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('crawl: what it visits', () => {
  it('follows links, resolving relative ones and dropping fragments', async () => {
    const { urls } = await run({
      [`${A}/`]: { links: ['/about', 'docs#intro', `${A}/about#team`] },
      [`${A}/about`]: {},
      [`${A}/docs`]: {},
    });
    expect(urls).toEqual([`${A}/`, `${A}/about`, `${A}/docs`]);
  });

  it('fetches each page once, even with cycles', async () => {
    const { site } = await run({
      [`${A}/`]: { links: ['/x', '/y'] },
      [`${A}/x`]: { links: ['/', '/y'] },
      [`${A}/y`]: { links: ['/x', '/'] },
    });
    expect(site.requests.sort()).toEqual([`${A}/`, `${A}/x`, `${A}/y`]);
  });

  it('stops at the depth limit and records depths', async () => {
    const { result, site } = await run(
      {
        [`${A}/`]: { links: ['/1'] },
        [`${A}/1`]: { links: ['/2'] },
        [`${A}/2`]: { links: ['/3'] },
        [`${A}/3`]: {},
      },
      { maxDepth: 2 },
    );
    expect(result.pages.map((p) => [p.url, p.depth]).sort()).toEqual([
      [`${A}/`, 0],
      [`${A}/1`, 1],
      [`${A}/2`, 2],
    ]);
    expect(site.requests).not.toContain(`${A}/3`);
  });

  it('ignores other hosts and non-http links unless allowed', async () => {
    const pages = {
      [`${A}/`]: { links: [`${B}/`, 'mailto:hi@a.test', 'javascript:void(0)'] },
      [`${B}/`]: {},
    };
    expect((await run(pages)).site.requests).toEqual([`${A}/`]);
    expect((await run(pages, { allowedHosts: ['a.test', 'b.test'] })).urls).toEqual([
      `${A}/`,
      `${B}/`,
    ]);
  });

  it('records failures and keeps going', async () => {
    const { result, urls } = await run({
      [`${A}/`]: { links: ['/missing', '/broken', '/fine', '/error'] },
      [`${A}/broken`]: { fail: 'connection reset' },
      [`${A}/error`]: { status: 500, links: ['/never'] },
      [`${A}/fine`]: {},
      [`${A}/never`]: {},
    });
    expect(urls).toEqual([`${A}/`, `${A}/fine`]);
    expect(result.errors.sort((x, y) => x.url.localeCompare(y.url))).toEqual([
      { url: `${A}/broken`, message: 'connection reset' },
      { url: `${A}/error`, message: 'HTTP 500' },
      { url: `${A}/missing`, message: 'HTTP 404' },
    ]);
  });
});

describe('crawl: speed and politeness', () => {
  const wide = (count: number, host = A) => {
    const children = Array.from({ length: count }, (_, i) => `${host}/p${i}`);
    return {
      [`${host}/`]: { links: children },
      ...Object.fromEntries(children.map((url) => [url, {}])),
    };
  };

  it('runs fetches in parallel up to the limit, and no further', async () => {
    const started = Date.now();
    const { site } = await run(wide(12), { maxConcurrency: 3 });
    expect(site.peakInFlight()).toBe(3);
    // 1 root, then 12 pages in batches of 3, 100 ms each: 500 ms, not 1,300 ms.
    expect(Date.now() - started).toBe(500);
  });

  it('spaces requests to one host by the interval', async () => {
    const { site } = await run(wide(4), { maxConcurrency: 4, perHostIntervalMs: 250 });
    const starts = site.startsByHost.get('a.test')!;
    expect(starts).toHaveLength(5);
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(250);
    }
  });

  it('does not let one slow host hold up another', async () => {
    const pages = {
      [`${A}/`]: { links: ['/a1', '/a2', '/a3', `${B}/b1`, `${B}/b2`, `${B}/b3`] },
      [`${A}/a1`]: {},
      [`${A}/a2`]: {},
      [`${A}/a3`]: {},
      [`${B}/b1`]: {},
      [`${B}/b2`]: {},
      [`${B}/b3`]: {},
    };
    const { site } = await run(pages, {
      maxConcurrency: 6,
      perHostIntervalMs: 1000,
      allowedHosts: ['a.test', 'b.test'],
    });
    // b.test gets its first request as soon as the root is parsed, not after a.test's queue.
    expect(site.startsByHost.get('b.test')![0]).toBe(100);
  });
});
