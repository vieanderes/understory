import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

/*
 * RSS 2.0, RSS 1.0 (RDF) and Atom in one reader. Feeds in the wild disagree about almost
 * everything, so each field is read from every place it is known to appear and the result
 * is one flat shape.
 */

export interface FeedEntry {
  title: string;
  link: string;
  published?: string;
  authors: string[];
  description?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Keep "2.10" a string, not the number 2.1.
  parseTagValue: false,
  trimValues: true,
  // Entities are decoded later by stripHtml. A parser that expands them is one more thing
  // that can be attacked with a crafted feed.
  processEntities: false,
});

const node = z.union([z.string(), z.record(z.string(), z.unknown())]);
type XmlNode = z.infer<typeof node>;

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** The text of a node that may be a string, or an object with attributes and `#text`. */
function textOf(value: unknown): string | undefined {
  const first = asArray(value)[0];
  const parsed = node.safeParse(first);
  if (!parsed.success) return undefined;
  const text = typeof parsed.data === 'string' ? parsed.data : parsed.data['#text'];
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : undefined;
}

function field(entry: Record<string, unknown>, names: readonly string[]): string | undefined {
  for (const name of names) {
    const text = textOf(entry[name]);
    if (text !== undefined) return text;
  }
  return undefined;
}

/** RSS: `<link>url</link>`. Atom: `<link href rel>`, where `alternate` or no rel is the page. */
function linkOf(entry: Record<string, unknown>): string | undefined {
  const links = asArray(entry.link).map((link) => node.safeParse(link).data);
  const objects = links.filter((link): link is Record<string, unknown> => typeof link === 'object');
  const page =
    objects.find((link) => link['@_rel'] === 'alternate') ??
    objects.find((link) => link['@_rel'] === undefined);
  const href = page?.['@_href'];
  if (typeof href === 'string' && href.length > 0) return href;
  const plain = links.find((link): link is string => typeof link === 'string');
  if (plain !== undefined) return plain;
  // Some RSS feeds only carry the address in a permalink guid.
  const guid = textOf(entry.guid);
  return guid !== undefined && /^https?:\/\//i.test(guid) ? guid : undefined;
}

function authorsOf(entry: Record<string, unknown>): string[] {
  const atom = asArray(entry.author).flatMap((author: unknown) => {
    const parsed: XmlNode | undefined = node.safeParse(author).data;
    if (parsed === undefined) return [];
    const name = typeof parsed === 'string' ? parsed : textOf(parsed.name);
    return name === undefined ? [] : [name];
  });
  const dublinCore = asArray(entry['dc:creator']).flatMap((creator) => textOf(creator) ?? []);
  return [...atom, ...dublinCore];
}

function toEntry(raw: unknown): FeedEntry | null {
  const entry = z.record(z.string(), z.unknown()).safeParse(raw).data;
  if (entry === undefined) return null;
  const title = field(entry, ['title']);
  const link = linkOf(entry);
  if (title === undefined || link === undefined) return null;
  const published = field(entry, ['pubDate', 'published', 'dc:date', 'updated']);
  // A summary is what the publisher offers as a teaser. Full content is the last resort,
  // and `normalise` cuts whichever is used to 280 characters.
  const description = field(entry, ['description', 'summary', 'content:encoded', 'content']);
  return {
    title,
    link,
    authors: authorsOf(entry),
    ...(published !== undefined && { published }),
    ...(description !== undefined && { description }),
  };
}

function entriesOf(document: Record<string, unknown>): unknown[] {
  const record = z.record(z.string(), z.unknown());
  const rss = record.safeParse(document.rss).data;
  const channel = record.safeParse(rss?.channel).data;
  if (channel !== undefined) return asArray(channel.item);
  const atom = record.safeParse(document.feed).data;
  if (atom !== undefined) return asArray(atom.entry);
  const rdf = record.safeParse(document['rdf:RDF']).data;
  if (rdf !== undefined) return asArray(rdf.item);
  throw new Error('Not an RSS or Atom document.');
}

export function parseFeed(xml: string): FeedEntry[] {
  const document = z.record(z.string(), z.unknown()).parse(parser.parse(xml));
  return entriesOf(document).flatMap((raw) => {
    const entry = toEntry(raw);
    return entry === null ? [] : [entry];
  });
}

/** arXiv adds its own elements to Atom. Exposed so the arXiv adapter can read them. */
export function parseXml(xml: string): Record<string, unknown> {
  return z.record(z.string(), z.unknown()).parse(parser.parse(xml));
}
