import type { RawItem } from '@/core/news';
import type { FeedConfig } from '../config';
import { politeFetch } from '../http';
import type { Source } from './types';
import { parseFeed, type FeedEntry } from './xml';

/** Some feeds carry their whole archive. The newest entries are all a daily run needs. */
const ENTRIES_PER_FEED = 15;

const FEED_ACCEPT =
  'application/atom+xml, application/rss+xml, application/xml;q=0.9, text/xml;q=0.8';

export function feedEntryToRaw(entry: FeedEntry, feed: FeedConfig): RawItem | null {
  // Without a date the item would look new on every run, so it is left out.
  if (entry.published === undefined) return null;
  return {
    sourceId: feed.id,
    sourceName: feed.name,
    kind: 'feed',
    url: entry.link,
    title: entry.title,
    publishedAt: entry.published,
    topicHints: feed.topics,
    ...(entry.authors.length > 0 && { authors: entry.authors }),
    ...(entry.description !== undefined && { description: entry.description }),
  };
}

export function parseFeedItems(xml: string, feed: FeedConfig): RawItem[] {
  return parseFeed(xml)
    .slice(0, ENTRIES_PER_FEED)
    .flatMap((entry) => feedEntryToRaw(entry, feed) ?? []);
}

/** One source per feed, so one broken feed is one line in the report and nothing more. */
export function feedSource(feed: FeedConfig): Source {
  return {
    id: feed.id,
    async fetch(ctx) {
      return parseFeedItems(await politeFetch(ctx, feed.url, { accept: FEED_ACCEPT }), feed);
    },
  };
}
