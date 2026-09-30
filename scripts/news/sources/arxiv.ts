import { z } from 'zod';
import type { RawItem } from '@/core/news';
import { politeFetch } from '../http';
import type { Source, SourceContext } from './types';
import { parseXml } from './xml';

/*
 * arXiv through its public API (https://info.arxiv.org/help/api). The terms of use ask
 * for no more than one request every three seconds, so pages are fetched one after the
 * other with a pause, and a retry waits just as long.
 */

const API = 'https://export.arxiv.org/api/query';
const SOURCE_ID = 'arxiv';
const SOURCE_NAME = 'arXiv';
export const ARXIV_CATEGORIES = [
  'cs.SE',
  'cs.AI',
  'cs.LG',
  'cs.CL',
  'cs.DC',
  'cs.DB',
  'cs.HC',
] as const;
export const ARXIV_MIN_INTERVAL_MS = 3_000;
const PAGE_SIZE = 100;
const PAGES = 2;
/** The export host is slow under load. */
const TIMEOUT_MS = 30_000;

const record = z.record(z.string(), z.unknown());

export function arxivUrl(start: number): string {
  const query = ARXIV_CATEGORIES.map((category) => `cat:${category}`).join('+OR+');
  // Built by hand: arXiv wants `+OR+` as written, and URLSearchParams would escape the `+`.
  return `${API}?search_query=${query}&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${PAGE_SIZE}`;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  const inner = record.safeParse(value).data?.['#text'];
  return typeof inner === 'string' ? inner : undefined;
}

function toRaw(entry: Record<string, unknown>): RawItem | null {
  const title = text(entry.title);
  const id = text(entry.id);
  if (title === undefined || id === undefined) return null;
  const authors = asArray(entry.author).flatMap(
    (author) => text(record.safeParse(author).data?.name) ?? [],
  );
  const published = text(entry.published);
  const summary = text(entry.summary);
  return {
    sourceId: SOURCE_ID,
    sourceName: SOURCE_NAME,
    kind: 'arxiv',
    // The id is the abstract page, with a version. `canonicalise` removes the version.
    url: id.replace(/^http:/, 'https:'),
    title,
    ...(published !== undefined && { publishedAt: published }),
    ...(authors.length > 0 && { authors }),
    // The abstract is the authors' own summary. Only its first 280 characters are kept.
    ...(summary !== undefined && { description: summary }),
  };
}

export function parseArxiv(xml: string): RawItem[] {
  const feed = record.safeParse(parseXml(xml).feed).data;
  if (feed === undefined) throw new Error('Not an arXiv Atom document.');
  return asArray(feed.entry).flatMap((entry) => {
    const parsed = record.safeParse(entry).data;
    const raw = parsed === undefined ? null : toRaw(parsed);
    return raw === null ? [] : [raw];
  });
}

async function fetchPage(ctx: SourceContext, page: number): Promise<RawItem[]> {
  if (page > 0) await ctx.sleep(ARXIV_MIN_INTERVAL_MS);
  const xml = await politeFetch(ctx, arxivUrl(page * PAGE_SIZE), {
    accept: 'application/atom+xml',
    timeoutMs: TIMEOUT_MS,
    backoffMs: ARXIV_MIN_INTERVAL_MS,
  });
  return parseArxiv(xml);
}

export const arxivSource: Source = {
  id: SOURCE_ID,
  async fetch(ctx) {
    const items: RawItem[] = [];
    for (let page = 0; page < PAGES; page += 1) {
      const found = await fetchPage(ctx, page);
      items.push(...found);
      if (found.length < PAGE_SIZE) break;
    }
    return items;
  },
};
