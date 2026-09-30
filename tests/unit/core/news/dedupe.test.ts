import { describe, expect, it } from 'vitest';
import { dedupe } from '@/core/news';
import { item } from './helpers';

const feedPost = item({
  id: '00000000000000a1',
  title: 'Training a 4B model to produce faster query plans than Postgres',
  canonicalUrl: 'https://example.com/qorl',
  topics: ['databases'],
});

const hnPost = item({
  id: '00000000000000a1',
  title: 'Training a 4B model to produce faster query plans than Postgres',
  canonicalUrl: 'https://example.com/qorl',
  url: 'https://example.com/qorl?utm_source=hn',
  source: { id: 'hn', name: 'Hacker News', kind: 'hn' },
  points: 555,
  comments: 118,
  discussionUrl: 'https://news.ycombinator.com/item?id=1',
  topics: ['ai-agents'],
});

describe('dedupe', () => {
  it('keeps one item per canonical URL', () => {
    expect(dedupe([feedPost, hnPost])).toHaveLength(1);
  });

  it('keeps the primary source and merges the discussion into it', () => {
    const [kept] = dedupe([hnPost, feedPost]);
    expect(kept?.source.kind).toBe('feed');
    expect(kept?.url).toBe('https://example.com/post');
    expect(kept?.discussionUrl).toBe('https://news.ycombinator.com/item?id=1');
    expect(kept?.points).toBe(555);
    expect(kept?.comments).toBe(118);
    expect(kept?.topics).toEqual(['databases', 'ai-agents']);
  });

  it('gives the same result whatever the input order', () => {
    expect(dedupe([hnPost, feedPost])).toEqual(dedupe([feedPost, hnPost]));
  });

  it('merges near-identical titles on different URLs', () => {
    const a = item({
      id: '00000000000000b1',
      canonicalUrl: 'https://a.example/1',
      title: 'Nvidia announces native GPU programming in Rust',
      source: { id: 'hn', name: 'Hacker News', kind: 'hn' },
      points: 700,
    });
    const b = item({
      id: '00000000000000b2',
      canonicalUrl: 'https://b.example/2',
      title: 'NVIDIA Announces Native GPU Programming in Rust!',
      source: { id: 'hn', name: 'Hacker News', kind: 'hn' },
      points: 90,
    });
    const result = dedupe([b, a]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('00000000000000b1');
    expect(result[0]?.points).toBe(700);
  });

  it('ignores aggregator decoration when comparing titles', () => {
    const a = item({
      id: '00000000000000c1',
      canonicalUrl: 'https://a.example/1',
      title: 'Show HN: Vectorized and portable Quicksort (2022)',
    });
    const b = item({
      id: '00000000000000c2',
      canonicalUrl: 'https://b.example/2',
      title: 'Vectorized and portable Quicksort',
    });
    expect(dedupe([a, b])).toHaveLength(1);
  });

  it('keeps titles that merely share a subject', () => {
    const a = item({
      id: '00000000000000d1',
      canonicalUrl: 'https://a.example/1',
      title: 'Deno 2.9',
    });
    const b = item({
      id: '00000000000000d2',
      canonicalUrl: 'https://a.example/2',
      title: 'Deno 2.8',
    });
    const c = item({
      id: '00000000000000d3',
      canonicalUrl: 'https://a.example/3',
      title: 'Postgres 19 ships asynchronous I/O for sequential scans',
    });
    const d = item({
      id: '00000000000000d4',
      canonicalUrl: 'https://a.example/4',
      title: 'Postgres 19 ships a new query planner for joins',
    });
    expect(dedupe([a, b, c, d])).toHaveLength(4);
  });

  it('does not merge one-word titles on similarity alone', () => {
    const a = item({
      id: '00000000000000e1',
      canonicalUrl: 'https://a.example/1',
      title: 'Backups',
    });
    const b = item({
      id: '00000000000000e2',
      canonicalUrl: 'https://b.example/2',
      title: 'Backups',
    });
    expect(dedupe([a, b])).toHaveLength(2);
  });

  it('prefers the item with more engagement within one kind, then the earlier one', () => {
    const early = item({
      id: '00000000000000f1',
      canonicalUrl: 'https://a.example/1',
      title: 'A long enough headline about one thing',
      publishedAt: '2026-09-16T00:00:00.000Z',
    });
    const late = item({
      id: '00000000000000f2',
      canonicalUrl: 'https://b.example/2',
      title: 'A long enough headline about one thing',
      publishedAt: '2026-09-17T00:00:00.000Z',
    });
    expect(dedupe([late, early])[0]?.id).toBe('00000000000000f1');
  });

  it('keeps an existing discussion link on the winner', () => {
    const winner = { ...feedPost, discussionUrl: 'https://lobste.rs/s/abc' };
    expect(dedupe([winner, hnPost])[0]?.discussionUrl).toBe('https://lobste.rs/s/abc');
  });

  it('returns an empty list for an empty list', () => {
    expect(dedupe([])).toEqual([]);
  });
});
