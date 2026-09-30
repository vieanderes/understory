import { describe, expect, it } from 'vitest';
import { rawItemSchema } from '@/core/news';
import { loadConfig } from '../../../../scripts/news/config';
import {
  ARXIV_MIN_INTERVAL_MS,
  arxivSource,
  arxivUrl,
  parseArxiv,
} from '../../../../scripts/news/sources/arxiv';
import { feedSource, parseFeedItems } from '../../../../scripts/news/sources/feeds';
import { HN_MIN_POINTS, hnSource, hnUrl, parseHn } from '../../../../scripts/news/sources/hn';
import { parseFeed } from '../../../../scripts/news/sources/xml';
import { fakeFetch, fakeSleep, fixture, hostIs, NOW, ok, REPO_ROOT } from './helpers';

const postgres = {
  id: 'postgresql',
  name: 'PostgreSQL News',
  url: 'https://www.postgresql.org/news.rss',
  weight: 0.7,
  topics: ['databases'],
};
const deno = {
  id: 'deno',
  name: 'Deno Blog',
  url: 'https://deno.com/feed',
  weight: 0.65,
  topics: ['web-platform'],
};

describe('Hacker News (Algolia)', () => {
  it('asks for stories of the last 24 hours above the points threshold', () => {
    const url = new URL(hnUrl(NOW));
    expect(url.origin + url.pathname).toBe('https://hn.algolia.com/api/v1/search');
    expect(url.searchParams.get('tags')).toBe('story');
    const since = Math.floor(NOW.getTime() / 1000) - 86_400;
    expect(url.searchParams.get('numericFilters')).toBe(
      `created_at_i>${since},points>${HN_MIN_POINTS}`,
    );
  });

  it('parses a recorded response', async () => {
    const items = parseHn(await fixture('hn-algolia.json'));
    expect(items).toHaveLength(12);
    for (const item of items) expect(rawItemSchema.safeParse(item).success).toBe(true);
    expect(items[0]).toEqual({
      sourceId: 'hn',
      sourceName: 'Hacker News',
      kind: 'hn',
      url: 'https://developer.nvidia.com/blog/introducing-cuda-rust-two-tracks-for-writing-gpu-kernels/',
      title: 'Nvidia announces native GPU programming in Rust',
      discussionUrl: expect.stringMatching(/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/),
      publishedAt: expect.stringMatching(/^2026-09-1[67]T/),
      points: expect.any(Number),
      comments: expect.any(Number),
    });
  });

  it('does not present the submitter as the author', async () => {
    for (const item of parseHn(await fixture('hn-algolia.json'))) {
      expect(item).not.toHaveProperty('authors');
    }
  });

  it('uses the thread as the link for a post without one, and skips broken hits', () => {
    const body = JSON.stringify({
      hits: [
        {
          objectID: '42',
          title: 'Ask HN: How do you test agents?',
          url: null,
          points: 150,
          story_text: '<p>Curious.</p>',
        },
        { objectID: '43', title: null },
        { nonsense: true },
      ],
    });
    const items = parseHn(body);
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe('https://news.ycombinator.com/item?id=42');
    expect(items[0]?.description).toBe('<p>Curious.</p>');
  });

  it('throws on a body that is not the API', () => {
    expect(() => parseHn('<html>rate limited</html>')).toThrow();
    expect(() => parseHn('{"message":"error"}')).toThrow();
  });

  it('keeps only the stories that touch an interest', async () => {
    const { interests } = await loadConfig(REPO_ROOT);
    const net = fakeFetch([
      {
        match: hostIs('hn.algolia.com'),
        respond: async () => ok(await fixture('hn-algolia.json')),
      },
    ]);
    const items = await hnSource.fetch({ ...net, ...fakeSleep(), now: NOW, interests });
    const titles = items.map((item) => item.title);
    expect(titles).toContain('Training a 4B model to produce 81% faster query plans than Postgres');
    expect(titles).not.toContain(
      'The Google Play app review process now regularly takes longer than a week',
    );
    expect(items.length).toBeLessThan(12);
  });
});

describe('arXiv', () => {
  it('asks for the seven categories, newest first', () => {
    const url = arxivUrl(100);
    expect(url).toContain(
      'https://export.arxiv.org/api/query?search_query=cat:cs.SE+OR+cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.DC+OR+cat:cs.DB+OR+cat:cs.HC',
    );
    expect(url).toContain('sortBy=submittedDate&sortOrder=descending&start=100');
  });

  it('parses a recorded Atom response', async () => {
    const items = parseArxiv(await fixture('arxiv.atom.xml'));
    expect(items).toHaveLength(4);
    for (const item of items) expect(rawItemSchema.safeParse(item).success).toBe(true);
    expect(items[0]).toMatchObject({
      sourceId: 'arxiv',
      kind: 'arxiv',
      url: 'https://arxiv.org/abs/2609.19145v1',
      title: 'Objective vs. Search: Decomposing What Makes a Good Tokeniser',
      publishedAt: '2026-09-16T17:59:45Z',
      authors: ['Ahmetcan Yavuz', 'Clara Meister', 'Tiago Pimentel'],
    });
    expect(items[0]?.description).toMatch(/^Two dominant tokenisation algorithms/);
  });

  it('throws on a body that is not Atom', () => {
    expect(() => parseArxiv('<html><body>Rate exceeded.</body></html>')).toThrow(/arXiv/);
  });

  it('waits three seconds between requests', async () => {
    const page = await fixture('arxiv.atom.xml');
    // A full page makes the adapter ask for the next one.
    const entry = page.slice(page.indexOf('<entry>'), page.indexOf('</entry>') + '</entry>'.length);
    const full = page.replace('</feed>', `${entry.repeat(96)}</feed>`);
    const net = fakeFetch([{ match: hostIs('export.arxiv.org'), respond: () => ok(full) }]);
    const clock = fakeSleep();
    const { interests } = await loadConfig(REPO_ROOT);
    const items = await arxivSource.fetch({ ...net, ...clock, now: NOW, interests });
    expect(ARXIV_MIN_INTERVAL_MS).toBe(3_000);
    expect(net.calls).toHaveLength(2);
    expect(clock.pauses).toEqual([3_000]);
    expect(items).toHaveLength(200);
  });

  it('stops after a short page', async () => {
    const net = fakeFetch([
      {
        match: hostIs('export.arxiv.org'),
        respond: async () => ok(await fixture('arxiv.atom.xml')),
      },
    ]);
    const { interests } = await loadConfig(REPO_ROOT);
    await arxivSource.fetch({ ...net, ...fakeSleep(), now: NOW, interests });
    expect(net.calls).toHaveLength(1);
  });
});

describe('RSS and Atom feeds', () => {
  it('parses a recorded RSS 2.0 feed', async () => {
    const items = parseFeedItems(await fixture('rss-postgresql.xml'), postgres);
    expect(items).toHaveLength(4);
    for (const item of items) expect(rawItemSchema.safeParse(item).success).toBe(true);
    expect(items[0]).toMatchObject({
      sourceId: 'postgresql',
      sourceName: 'PostgreSQL News',
      kind: 'feed',
      title: 'pgAssistant 3.8.0 : continuous improvement loop for Postgres',
      url: 'https://www.postgresql.org/about/news/pgassistant-380-continuous-improvement-loop-for-postgres-3378/',
      publishedAt: 'Wed, 16 Sep 2026 00:00:00 +0000',
      topicHints: ['databases'],
    });
    expect(items[0]?.description).toContain('pgAssistant');
  });

  it('parses a recorded Atom feed', async () => {
    const items = parseFeedItems(await fixture('atom-deno.xml'), deno);
    expect(items.map((item) => item.title)).toEqual([
      'Deno 2.9',
      'Deno 2.8',
      'Claw Patrol: an open-source security firewall for agents',
      'Fresh 2.3: Zero JS by default, View Transitions, and Temporal support',
    ]);
    expect(items[0]).toMatchObject({
      url: 'https://deno.com/blog/v2.9',
      publishedAt: '2026-06-25T09:00:00.000Z',
      authors: ['Bartek Iwańczuk'],
    });
    expect(items[0]?.description).toMatch(/^`deno desktop`/);
  });

  it('prefers the alternate link of an Atom entry and falls back to a permalink guid', () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>T</title>
      <link rel="self" href="https://x.example/self"/><link rel="alternate" href="https://x.example/page"/>
      <updated>2026-09-16T00:00:00Z</updated></entry></feed>`;
    expect(parseFeed(atom)[0]?.link).toBe('https://x.example/page');
    const rss = `<rss><channel><item><title>T</title><guid>https://x.example/guid</guid>
      <pubDate>Wed, 16 Sep 2026 00:00:00 +0000</pubDate><dc:creator>Ada</dc:creator></item></channel></rss>`;
    expect(parseFeed(rss)[0]).toMatchObject({ link: 'https://x.example/guid', authors: ['Ada'] });
  });

  it('reads RSS 1.0 (RDF)', () => {
    const rdf = `<rdf:RDF><item><title>T</title><link>https://x.example/1</link><dc:date>2026-09-16</dc:date></item></rdf:RDF>`;
    expect(parseFeed(rdf)).toEqual([
      { title: 'T', link: 'https://x.example/1', published: '2026-09-16', authors: [] },
    ]);
  });

  it('skips entries without a title, a link or a date', () => {
    const rss = `<rss><channel>
      <item><title>No link</title><pubDate>Wed, 16 Sep 2026 00:00:00 +0000</pubDate></item>
      <item><link>https://x.example/no-title</link></item>
      <item><title>No date</title><link>https://x.example/no-date</link></item>
    </channel></rss>`;
    expect(parseFeedItems(rss, postgres)).toEqual([]);
  });

  it('takes only the newest entries of a feed that carries its archive', () => {
    const items = Array.from(
      { length: 40 },
      (_, i) =>
        `<item><title>Post ${i}</title><link>https://x.example/${i}</link><pubDate>Wed, 16 Sep 2026 00:00:00 +0000</pubDate></item>`,
    );
    expect(
      parseFeedItems(`<rss><channel>${items.join('')}</channel></rss>`, postgres),
    ).toHaveLength(15);
  });

  it('does not expand entities, so a crafted feed cannot blow up the parser', () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]>
      <rss><channel><item><title>&b;&b;&b;</title><link>https://x.example/1</link></item></channel></rss>`;
    expect(parseFeed(bomb)[0]?.title).toBe('&b;&b;&b;');
  });

  it('throws on a page that is not a feed', () => {
    expect(() => parseFeed('<html><body>Not found</body></html>')).toThrow(/RSS or Atom/);
  });

  it('fetches through the polite client', async () => {
    const net = fakeFetch([
      { match: hostIs('deno.com'), respond: async () => ok(await fixture('atom-deno.xml')) },
    ]);
    const { interests } = await loadConfig(REPO_ROOT);
    const items = await feedSource(deno).fetch({ ...net, ...fakeSleep(), now: NOW, interests });
    expect(items).toHaveLength(4);
    expect(net.calls[0]?.url).toBe('https://deno.com/feed');
  });
});
