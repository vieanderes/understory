import { describe, expect, it } from 'vitest';
import { EXCERPT_MAX_CHARS, itemId, newsItemSchema, normalise, type RawItem } from '@/core/news';
import { NOW } from './helpers';

const raw = (overrides: Partial<RawItem> = {}): RawItem => ({
  sourceId: 'postgres',
  sourceName: 'PostgreSQL News',
  kind: 'feed',
  url: 'https://www.postgresql.org/about/news/x-1/?utm_source=rss',
  title: '  PostgreSQL 19\n Released ',
  publishedAt: 'Wed, 16 Sep 2026 00:00:00 +0000',
  ...overrides,
});

describe('normalise', () => {
  it('produces a schema-valid item with a stable id', () => {
    const item = normalise(raw(), NOW);
    expect(item).not.toBeNull();
    expect(newsItemSchema.safeParse(item).success).toBe(true);
    expect(item?.canonicalUrl).toBe('https://postgresql.org/about/news/x-1');
    expect(item?.id).toBe(itemId('https://postgresql.org/about/news/x-1'));
    expect(item?.url).toBe('https://www.postgresql.org/about/news/x-1/?utm_source=rss');
    expect(item?.title).toBe('PostgreSQL 19 Released');
    expect(item?.source).toEqual({ id: 'postgres', name: 'PostgreSQL News', kind: 'feed' });
    expect(item?.publishedAt).toBe('2026-09-16T00:00:00.000Z');
    expect(item?.fetchedAt).toBe('2026-09-17T06:00:00.000Z');
    expect(item?.score).toBe(0);
  });

  it('decodes entities in titles', () => {
    expect(normalise(raw({ title: 'Locks &amp; latches &#8211; a primer' }), NOW)?.title).toBe(
      'Locks & latches – a primer',
    );
  });

  it('strips markup from the description and caps it', () => {
    const description = `<p>With this release, <strong>pgAssistant</strong> &amp; friends.</p>${'<p>More words follow here.</p>'.repeat(40)}`;
    const excerpt = normalise(raw({ description }), NOW)?.excerpt ?? '';
    expect(excerpt.startsWith('With this release, pgAssistant & friends.')).toBe(true);
    expect(excerpt).not.toMatch(/[<>]/);
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    expect(excerpt.endsWith('...')).toBe(true);
  });

  it('handles markup that was escaped twice', () => {
    const excerpt = normalise(
      raw({ description: '&lt;p&gt;Plain &amp;amp; simple&lt;/p&gt;' }),
      NOW,
    )?.excerpt;
    expect(excerpt).toBe('Plain & simple');
  });

  it('omits an empty excerpt instead of storing an empty string', () => {
    expect(normalise(raw({ description: '<p> </p>' }), NOW)).not.toHaveProperty('excerpt');
  });

  it('omits an excerpt that only repeats the title', () => {
    expect(normalise(raw({ description: 'PostgreSQL 19 Released' }), NOW)).not.toHaveProperty(
      'excerpt',
    );
  });

  it('drops a headline repeated at the start of the excerpt', () => {
    const excerpt = normalise(
      raw({ description: 'PostgreSQL 19 Released: The project announced a new version.' }),
      NOW,
    )?.excerpt;
    expect(excerpt).toBe('The project announced a new version.');
  });

  it.each([
    ['The post PostgreSQL 19 appeared first on Example Blog.', undefined],
    ['A real sentence. The post PostgreSQL 19 appeared first on Example Blog.', 'A real sentence.'],
    ['Security fix for table names. Tags: security, datasette', 'Security fix for table names.'],
    ['A real sentence. Read more', 'A real sentence.'],
    ['A real sentence. Continue reading →', 'A real sentence.'],
  ])('drops feed boilerplate from %j', (description, expected) => {
    expect(normalise(raw({ description }), NOW)?.excerpt).toBe(expected);
  });

  it('falls back to the fetch time when the date is missing or unreadable', () => {
    expect(normalise(raw({ publishedAt: undefined }), NOW)?.publishedAt).toBe(NOW.toISOString());
    expect(normalise(raw({ publishedAt: 'yesterday-ish' }), NOW)?.publishedAt).toBe(
      NOW.toISOString(),
    );
  });

  it('clamps a date in the future, so a wrong clock cannot buy a recency bonus', () => {
    expect(normalise(raw({ publishedAt: '2030-01-01T00:00:00Z' }), NOW)?.publishedAt).toBe(
      NOW.toISOString(),
    );
  });

  it('keeps engagement numbers as non-negative integers', () => {
    const item = normalise(raw({ kind: 'hn', points: 412.6, comments: -3 }), NOW);
    expect(item?.points).toBe(412);
    expect(item?.comments).toBe(0);
  });

  it('keeps a valid discussion link and drops an invalid one', () => {
    const good = normalise(raw({ discussionUrl: 'https://news.ycombinator.com/item?id=1' }), NOW);
    expect(good?.discussionUrl).toBe('https://news.ycombinator.com/item?id=1');
    expect(normalise(raw({ discussionUrl: 'nope' }), NOW)).not.toHaveProperty('discussionUrl');
  });

  it('cleans author names and caps the list', () => {
    const authors = [' Ada  Lovelace ', '', ...Array.from({ length: 12 }, (_, i) => `Author ${i}`)];
    const item = normalise(raw({ authors }), NOW);
    expect(item?.authors?.[0]).toBe('Ada Lovelace');
    expect(item?.authors).toHaveLength(8);
    expect(normalise(raw({ authors: [' '] }), NOW)).not.toHaveProperty('authors');
  });

  it('carries topic hints as the first topics', () => {
    expect(normalise(raw({ topicHints: ['databases', 'Not A Slug'] }), NOW)?.topics).toEqual([
      'databases',
    ]);
  });

  it.each([
    ['no title', { title: '   ' }],
    ['no usable URL', { url: 'javascript:void(0)' }],
  ])('returns null for an item with %s', (_name, overrides) => {
    expect(normalise(raw(overrides), NOW)).toBeNull();
  });

  it('cuts an over-long title', () => {
    const item = normalise(raw({ title: 'word '.repeat(100) }), NOW);
    expect(item?.title.length).toBeLessThanOrEqual(300);
  });
});
