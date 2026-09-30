/**
 * The only import surface for Signal pages. Server components call these getters; they
 * never touch the file layout or the store directly, so the move to a Postgres store
 * later changes this file and nothing in `src/app` or `src/features`.
 *
 * Server only: this module reads the file system.
 */
import path from 'node:path';
import { FileNewsStore } from '@/adapters/news-file';
import {
  isoDateSchema,
  monthRange,
  rollup,
  weekRange,
  type DateRange,
  type DigestPeriod,
  type IsoDate,
  type NewsDay,
  type NewsDigest,
} from '@/core/news';
import type { NewsStore } from '@/core/ports/news-store';

export type {
  Brief,
  IsoDate,
  KeyConcept,
  NewsDay,
  NewsDigest,
  NewsItem,
  NewsSource,
  RecallCard,
  Thread,
  TopicCount,
} from '@/core/news';

/** `NEWS_DATA_DIR` lets tests and a VPS point the readers somewhere else. */
const newsRoot = (): string =>
  process.env.NEWS_DATA_DIR ?? path.join(process.cwd(), 'data', 'news');

/** Built per call: the store holds no state, and tests change the folder between calls. */
const store = (): NewsStore & { listDates(): Promise<IsoDate[]> } => new FileNewsStore(newsRoot());

/** The newest day there is, or null before the first pipeline run. */
export async function getLatestDay(): Promise<NewsDay | null> {
  const news = store();
  const latest = await news.latestDate();
  return latest === null ? null : news.day(latest);
}

/** One day, or null. A malformed date (route params are user input) is also null. */
export async function getDay(date: string): Promise<NewsDay | null> {
  return isoDateSchema.safeParse(date).success ? store().day(date) : null;
}

/**
 * Digests are rebuilt from the days on every call. The day files are the truth, a month is
 * at most 31 small files, and the pages are static, so a stored roll-up could only be
 * staler, never faster where it counts. (The pipeline still writes roll-up files for
 * readers that cannot run this code, such as the iOS app.)
 */
async function digest(
  period: DigestPeriod,
  key: string,
  range: DateRange | null,
): Promise<NewsDigest | null> {
  if (range === null) return null;
  return rollup(await store().range(range.from, range.to), period, key);
}

/** `isoWeek` is written `2026-W38`. Null when the key is malformed or the week is empty. */
export async function getWeek(isoWeek: string): Promise<NewsDigest | null> {
  return digest('week', isoWeek, weekRange(isoWeek));
}

/** `yyyyMm` is written `2026-09`. Null when the key is malformed or the month is empty. */
export async function getMonth(yyyyMm: string): Promise<NewsDigest | null> {
  return digest('month', yyyyMm, monthRange(yyyyMm));
}

/** Every date with a news day, newest first. */
export async function listDates(): Promise<IsoDate[]> {
  return store().listDates();
}
