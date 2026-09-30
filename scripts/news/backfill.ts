/**
 * `pnpm news:backfill --from YYYY-MM-DD --to YYYY-MM-DD`: writes the days a daily run
 * would have written, had it existed then. One use: a new installation whose week and
 * month pages would otherwise roll up a single day.
 *
 * Each day runs the ordinary pipeline with the clock set to 05:30 UTC of that day. Only the
 * sources differ, because "the newest" is the wrong question about the past:
 *
 * - Hacker News and arXiv are asked for a closed time window that ends at the day's clock.
 * - A feed is fetched once for the whole run, and entries published after the day's clock
 *   are hidden. A busy feed does not reach back far, so old days lean on the other two.
 *
 * Briefs are extractive. Days that exist are skipped, so a second run changes nothing.
 */
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { FileNewsStore } from '@/adapters/news-file';
import {
  DEFAULT_SELECTION,
  addDays,
  classify,
  isoDateSchema,
  normalise,
  type IsoDate,
} from '@/core/news';
import type { NewsDigestStore, NewsStore } from '@/core/ports/news-store';
import { loadConfig, type FeedConfig } from './config';
import { politeFetch, type FetchLike } from './http';
import { runPipeline } from './pipeline';
import { ARXIV_CATEGORIES, ARXIV_MIN_INTERVAL_MS, parseArxiv } from './sources/arxiv';
import { feedEntryToRaw } from './sources/feeds';
import { HN_MIN_POINTS, parseHn } from './sources/hn';
import type { Source } from './sources/types';
import { parseFeed } from './sources/xml';

const USAGE = 'Usage: pnpm news:backfill --from YYYY-MM-DD --to YYYY-MM-DD';
/** The hour of the scheduled run, so a backfilled day sees what that run would have seen. */
const RUN_TIME_UTC = 'T05:30:00.000Z';
const HN_WINDOW_SECONDS = 24 * 60 * 60;
const ARXIV_WINDOW_HOURS = 72;
const ARXIV_PAGE_SIZE = 100;
const ARXIV_PAGES = 2;
const ENTRIES_PER_FEED = 15;
/** Matches the pipeline's window for "shown lately", here looking forwards as well. */
const SEEN_WINDOW_DAYS = 14;

const hnThen: Source = {
  id: 'hn',
  async fetch(ctx) {
    const until = Math.floor(ctx.now.getTime() / 1000);
    const params = new URLSearchParams({
      tags: 'story',
      numericFilters: `created_at_i>${until - HN_WINDOW_SECONDS},created_at_i<=${until},points>${HN_MIN_POINTS}`,
      hitsPerPage: '100',
    });
    const body = await politeFetch(ctx, `https://hn.algolia.com/api/v1/search?${params}`, {
      accept: 'application/json',
    });
    return parseHn(body).filter((raw) => {
      const item = normalise(raw, ctx.now);
      return item !== null && classify(item, ctx.interests).length > 0;
    });
  },
};

/** arXiv writes instants as YYYYMMDDHHMM, in GMT. */
function arxivStamp(instant: Date): string {
  return instant.toISOString().replace(/\D/g, '').slice(0, 12);
}

const arxivThen: Source = {
  id: 'arxiv',
  async fetch(ctx) {
    const categories = ARXIV_CATEGORIES.map((category) => `cat:${category}`).join('+OR+');
    const from = new Date(ctx.now.getTime() - ARXIV_WINDOW_HOURS * 3_600_000);
    const window = `submittedDate:[${arxivStamp(from)}+TO+${arxivStamp(ctx.now)}]`;
    const items = [];
    for (let page = 0; page < ARXIV_PAGES; page += 1) {
      // The terms of use ask for three seconds between requests, across days as well.
      await ctx.sleep(ARXIV_MIN_INTERVAL_MS);
      const url =
        `https://export.arxiv.org/api/query?search_query=(${categories})+AND+${window}` +
        `&sortBy=submittedDate&sortOrder=descending&start=${page * ARXIV_PAGE_SIZE}&max_results=${ARXIV_PAGE_SIZE}`;
      const found = parseArxiv(
        await politeFetch(ctx, url, {
          accept: 'application/atom+xml',
          timeoutMs: 30_000,
          backoffMs: ARXIV_MIN_INTERVAL_MS,
        }),
      );
      items.push(...found);
      if (found.length < ARXIV_PAGE_SIZE) break;
    }
    return items;
  },
};

function feedThen(feed: FeedConfig): Source {
  return {
    id: feed.id,
    async fetch(ctx) {
      const xml = await politeFetch(ctx, feed.url, { accept: 'application/atom+xml, */*;q=0.8' });
      return parseFeed(xml)
        .filter(
          (entry) =>
            // `normalise` moves a future date to the clock, which would make next week's
            // post today's news. The past must not see it at all.
            entry.published !== undefined && Date.parse(entry.published) <= ctx.now.getTime(),
        )
        .slice(0, ENTRIES_PER_FEED)
        .flatMap((entry) => feedEntryToRaw(entry, feed) ?? []);
    },
  };
}

/** A feed says the same thing for every day of the run, so it is asked once. */
function rememberFeeds(fetchLike: FetchLike, feedUrls: ReadonlySet<string>): FetchLike {
  const bodies = new Map<string, string>();
  return async (url, init) => {
    if (!feedUrls.has(url)) return fetchLike(url, init);
    const known = bodies.get(url);
    if (known !== undefined) return new Response(known);
    const response = await fetchLike(url, init);
    if (!response.ok) return response;
    const body = await response.text();
    bodies.set(url, body);
    return new Response(body);
  };
}

/**
 * The pipeline leaves out what the fourteen days before showed. A backfilled day also has
 * days after it, and a story they carry must not appear a second time.
 */
function seeingAhead(
  store: NewsStore & NewsDigestStore,
  date: IsoDate,
): NewsStore & NewsDigestStore {
  return {
    day: (d) => store.day(d),
    latestDate: () => store.latestDate(),
    putDay: (day) => store.putDay(day),
    digest: (period, key) => store.digest(period, key),
    putDigest: (digest) => store.putDigest(digest),
    range: (from, to) =>
      store.range(from, to === addDays(date, -1) ? addDays(date, SEEN_WINDOW_DAYS) : to),
  };
}

function dateArg(args: readonly string[], flag: string): IsoDate {
  const value = args[args.indexOf(flag) + 1];
  const parsed = isoDateSchema.safeParse(args.includes(flag) ? value : undefined);
  if (!parsed.success) throw new Error(`${flag} must be written YYYY-MM-DD.\n\n${USAGE}`);
  return parsed.data;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const from = dateArg(args, '--from');
  const to = dateArg(args, '--to');

  const root = process.cwd();
  const config = await loadConfig(root);
  const store = new FileNewsStore(process.env.NEWS_DATA_DIR ?? path.join(root, 'data', 'news'));
  const http = {
    fetch: rememberFeeds((url, init) => fetch(url, init), new Set(config.feeds.map((f) => f.url))),
    sleep: (ms: number) => sleep(ms),
  };
  const sources = [hnThen, arxivThen, ...config.feeds.map(feedThen)];

  // Oldest first, so every day knows what the days before it showed.
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if ((await store.day(date)) !== null) {
      console.error(`Signal ${date}: exists, skipped`);
      continue;
    }
    await runPipeline(
      {
        ...http,
        store: seeingAhead(store, date),
        sources,
        config,
        summariser: null,
        now: new Date(`${date}${RUN_TIME_UTC}`),
        log: (line) => console.error(line),
      },
      { date, dryRun: false, max: DEFAULT_SELECTION.max },
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
