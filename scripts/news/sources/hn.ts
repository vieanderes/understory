import { z } from 'zod';
import { classify, normalise, type RawItem } from '@/core/news';
import { politeFetch } from '../http';
import type { Source, SourceContext } from './types';

/*
 * Hacker News through the Algolia search API (https://hn.algolia.com/api), which needs no
 * key. One request: stories of the last 24 hours above a points threshold, most points
 * first. The threshold is a proxy for "was on the front page".
 */

const API = 'https://hn.algolia.com/api/v1/search';
const ITEM_PAGE = 'https://news.ycombinator.com/item?id=';
const SOURCE_ID = 'hn';
const SOURCE_NAME = 'Hacker News';
const WINDOW_SECONDS = 24 * 60 * 60;
export const HN_MIN_POINTS = 100;
const HITS_PER_PAGE = 100;

/** `author` is left out on purpose: it is who submitted the link, not who wrote the piece. */
const hitSchema = z.object({
  objectID: z.string(),
  title: z.string().nullish(),
  url: z.string().nullish(),
  points: z.number().nullish(),
  num_comments: z.number().nullish(),
  created_at: z.string().nullish(),
  story_text: z.string().nullish(),
});

const responseSchema = z.object({ hits: z.array(z.unknown()) });

export function hnUrl(now: Date): string {
  const since = Math.floor(now.getTime() / 1000) - WINDOW_SECONDS;
  const params = new URLSearchParams({
    tags: 'story',
    numericFilters: `created_at_i>${since},points>${HN_MIN_POINTS}`,
    hitsPerPage: String(HITS_PER_PAGE),
  });
  return `${API}?${params.toString()}`;
}

function toRaw(hit: z.infer<typeof hitSchema>): RawItem | null {
  if (hit.title === null || hit.title === undefined) return null;
  const discussionUrl = `${ITEM_PAGE}${hit.objectID}`;
  return {
    sourceId: SOURCE_ID,
    sourceName: SOURCE_NAME,
    kind: 'hn',
    // Ask HN and similar posts have no link: the thread is the story.
    url: hit.url ?? discussionUrl,
    title: hit.title,
    discussionUrl,
    ...(hit.created_at != null && { publishedAt: hit.created_at }),
    ...(hit.points != null && { points: hit.points }),
    ...(hit.num_comments != null && { comments: hit.num_comments }),
    ...(hit.story_text != null && { description: hit.story_text }),
  };
}

export function parseHn(body: string): RawItem[] {
  const { hits } = responseSchema.parse(JSON.parse(body));
  return hits.flatMap((hit) => {
    // One malformed hit must not cost the whole page.
    const parsed = hitSchema.safeParse(hit);
    const raw = parsed.success ? toRaw(parsed.data) : null;
    return raw === null ? [] : [raw];
  });
}

/** The front page is mostly not about software. Keep what touches one of the interests. */
function matchesInterests(raw: RawItem, ctx: SourceContext): boolean {
  const item = normalise(raw, ctx.now);
  return item !== null && classify(item, ctx.interests).length > 0;
}

export const hnSource: Source = {
  id: SOURCE_ID,
  async fetch(ctx) {
    const body = await politeFetch(ctx, hnUrl(ctx.now), { accept: 'application/json' });
    return parseHn(body).filter((raw) => matchesInterests(raw, ctx));
  },
};
