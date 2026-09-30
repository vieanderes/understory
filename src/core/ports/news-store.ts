import type { DigestPeriod, IsoDate, NewsDay, NewsDigest } from '../news/schema';

/**
 * Where news days live. The pipeline writes through this port and the app reads through
 * it, so moving from JSON files in the repository to Postgres on a VPS is a new adapter,
 * not a rewrite (docs/ARCHITECTURE.md, "News on Hetzner").
 *
 * Contract for every adapter:
 *  - `putDay` is idempotent. Writing a day again merges by item id and keeps the briefs
 *    that are already stored (`mergeDay` in src/core/news holds the rule).
 *  - Reads return validated data or null. An adapter never hands back a day that fails
 *    `newsDaySchema`.
 */
export interface NewsStore {
  day(date: IsoDate): Promise<NewsDay | null>;
  /** Days with `from <= date <= to`, oldest first. Missing days are skipped. */
  range(from: IsoDate, to: IsoDate): Promise<NewsDay[]>;
  latestDate(): Promise<IsoDate | null>;
  putDay(day: NewsDay): Promise<void>;
}

/**
 * Weekly and monthly roll-ups are derived data: `rollup` can always rebuild them from the
 * days. Storing them is an optimisation for readers, so it is a separate, optional port.
 */
export interface NewsDigestStore {
  digest(period: DigestPeriod, key: string): Promise<NewsDigest | null>;
  putDigest(digest: NewsDigest): Promise<void>;
}
