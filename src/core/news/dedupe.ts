import type { NewsItem, SourceKind } from './schema';
import { jaccard, titleTokens } from './text';

/** Two headlines this similar are one story. Set by looking at real front pages. */
export const TITLE_SIMILARITY_THRESHOLD = 0.8;

/**
 * Short titles ("Backups", "Deno 2.9") are similar by accident, so similarity alone
 * merges only titles with at least this many meaningful tokens.
 */
const MIN_TOKENS_FOR_TITLE_MATCH = 3;

/**
 * "Best-sourced" means closest to the author. A feed entry is the publisher speaking, an
 * arXiv entry is the paper itself, and an aggregator entry is a pointer to either.
 */
const KIND_RANK: Readonly<Record<SourceKind, number>> = { feed: 0, arxiv: 1, hn: 2 };

function engagement(item: NewsItem): number {
  return (item.points ?? 0) + (item.comments ?? 0);
}

/** Negative when `a` is the better representative of a story. Total, so order-independent. */
function compareQuality(a: NewsItem, b: NewsItem): number {
  return (
    KIND_RANK[a.source.kind] - KIND_RANK[b.source.kind] ||
    engagement(b) - engagement(a) ||
    a.publishedAt.localeCompare(b.publishedAt) ||
    a.source.id.localeCompare(b.source.id) ||
    a.id.localeCompare(b.id)
  );
}

function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/** The winner keeps its own words and link, and gains what the other copy knew. */
function absorb(winner: NewsItem, other: NewsItem): NewsItem {
  const points = maxDefined(winner.points, other.points);
  const comments = maxDefined(winner.comments, other.comments);
  const discussionUrl = winner.discussionUrl ?? other.discussionUrl;
  const excerpt = winner.excerpt ?? other.excerpt;
  const authors = winner.authors ?? other.authors;
  return {
    ...winner,
    topics: [...new Set([...winner.topics, ...other.topics])],
    ...(authors !== undefined && { authors }),
    ...(points !== undefined && { points }),
    ...(comments !== undefined && { comments }),
    ...(discussionUrl !== undefined && { discussionUrl }),
    ...(excerpt !== undefined && { excerpt }),
  };
}

interface Kept {
  item: NewsItem;
  tokens: Set<string>;
}

function sameStory(kept: Kept, candidate: NewsItem, tokens: Set<string>): boolean {
  if (kept.item.canonicalUrl === candidate.canonicalUrl) return true;
  if (Math.min(kept.tokens.size, tokens.size) < MIN_TOKENS_FOR_TITLE_MATCH) return false;
  return jaccard(kept.tokens, tokens) >= TITLE_SIMILARITY_THRESHOLD;
}

/**
 * One item per story. Items are visited best first, so the first copy seen is the one
 * that stays and later copies only add their discussion link and numbers to it.
 *
 * Quadratic in the number of items. A day is a few hundred items, so this stays well under
 * a second and needs no index.
 */
export function dedupe(items: readonly NewsItem[]): NewsItem[] {
  const kept: Kept[] = [];
  for (const candidate of [...items].sort(compareQuality)) {
    const tokens = titleTokens(candidate.title);
    const match = kept.find((entry) => sameStory(entry, candidate, tokens));
    if (match === undefined) kept.push({ item: candidate, tokens });
    else match.item = absorb(match.item, candidate);
  }
  return kept.map((entry) => entry.item);
}
