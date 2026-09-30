import { canonicalise } from './canonicalise';
import { itemId } from './hash';
import { EXCERPT_MAX_CHARS, type NewsItem, type RawItem } from './schema';
import { collapseWhitespace, decodeEntities, stripHtml, truncateChars } from './text';

const TITLE_MAX_CHARS = 300;
const AUTHORS_MAX = 8;
const TOPIC_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HTTP_URL = /^https?:\/\/\S+$/i;

function cleanCount(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}

/**
 * A source may send no date, an unreadable one, or one in the future. All three become
 * the fetch time, so a wrong clock at the source can never buy a recency bonus.
 */
function cleanInstant(value: string | undefined, now: Date): string {
  if (value === undefined) return now.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > now.getTime()) return now.toISOString();
  return parsed.toISOString();
}

/**
 * Lines that feed software appends to every description. They say nothing about the story,
 * and they would otherwise be repeated by the extractive brief.
 */
const FEED_BOILERPLATE: readonly RegExp[] = [
  /\s*The post .{1,300}? (?:appeared first|first appeared) on .{1,100}?\.?\s*$/i,
  /\s*Tags:\s[^.]{0,200}$/i,
  /\s*(?:Read more|Continue reading|Read the full (?:story|post|article))\W{0,5}$/i,
];

function withoutBoilerplate(text: string): string {
  return FEED_BOILERPLATE.reduce((current, pattern) => current.replace(pattern, ''), text).trim();
}

function cleanExcerpt(description: string | undefined, title: string): string | undefined {
  if (description === undefined) return undefined;
  const stripped = stripHtml(description);
  // Some feeds repeat the headline as the description, or open the description with it.
  // Either way it tells the reader nothing the title has not said.
  const body = stripped.toLowerCase().startsWith(title.toLowerCase())
    ? stripped.slice(title.length).replace(/^[\s:.,;|-]+/, '')
    : stripped;
  const plain = withoutBoilerplate(body);
  return plain.length === 0 ? undefined : truncateChars(plain, EXCERPT_MAX_CHARS);
}

function cleanAuthors(authors: readonly string[] | undefined): string[] | undefined {
  const cleaned = (authors ?? [])
    .map((author) => collapseWhitespace(decodeEntities(author)))
    .filter((author) => author.length > 0)
    .slice(0, AUTHORS_MAX);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Turns what an adapter found into an item the rest of the pipeline can trust.
 * Returns null when the item cannot be identified (no title, or no http(s) URL).
 */
export function normalise(raw: RawItem, now: Date): NewsItem | null {
  const url = raw.url.trim();
  const canonicalUrl = canonicalise(url);
  const title = truncateChars(collapseWhitespace(stripHtml(raw.title)), TITLE_MAX_CHARS);
  if (canonicalUrl === null || title.length === 0) return null;

  const authors = cleanAuthors(raw.authors);
  const points = cleanCount(raw.points);
  const comments = cleanCount(raw.comments);
  const discussionUrl = raw.discussionUrl?.trim();
  const excerpt = cleanExcerpt(raw.description, title);

  // Optional fields are left out, never set to undefined, so the JSON stays minimal.
  return {
    id: itemId(canonicalUrl),
    url,
    canonicalUrl,
    title,
    source: { id: raw.sourceId, name: raw.sourceName, kind: raw.kind },
    publishedAt: cleanInstant(raw.publishedAt, now),
    fetchedAt: now.toISOString(),
    ...(authors !== undefined && { authors }),
    ...(points !== undefined && { points }),
    ...(comments !== undefined && { comments }),
    ...(discussionUrl !== undefined && HTTP_URL.test(discussionUrl) && { discussionUrl }),
    topics: [...new Set((raw.topicHints ?? []).filter((hint) => TOPIC_ID.test(hint)))],
    score: 0,
    ...(excerpt !== undefined && { excerpt }),
  };
}
