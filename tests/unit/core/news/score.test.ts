import { describe, expect, it } from 'vitest';
import { exclusionReason, score } from '@/core/news';
import { interests, item, NOW } from './helpers';

const base = item({ topics: ['databases'], publishedAt: '2026-09-17T00:00:00.000Z' });

describe('score', () => {
  it('is positive for any item that is not excluded', () => {
    expect(score(item(), interests, NOW)).toBeGreaterThan(0);
  });

  it('never falls when points rise', () => {
    let previous = score({ ...base, points: 0 }, interests, NOW);
    for (const points of [1, 5, 50, 500, 5_000, 50_000, 5_000_000]) {
      const current = score({ ...base, points }, interests, NOW);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('never falls when comments rise', () => {
    let previous = score({ ...base, comments: 0 }, interests, NOW);
    for (const comments of [1, 10, 100, 1_000, 100_000]) {
      const current = score({ ...base, comments }, interests, NOW);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('rewards the first hundred points more than the next hundred', () => {
    const at = (points: number) => score({ ...base, points }, interests, NOW);
    expect(at(100) - at(0)).toBeGreaterThan(at(200) - at(100));
  });

  it('never rises as an item ages', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const hours of [0, 1, 6, 24, 36, 72, 24 * 30]) {
      const publishedAt = new Date(NOW.getTime() - hours * 3_600_000).toISOString();
      const current = score({ ...base, publishedAt }, interests, NOW);
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it('halves the recency part after one half-life', () => {
    const only = { ...interests, weights: { topic: 0, source: 0, engagement: 0, recency: 1 } };
    const fresh = score({ ...base, publishedAt: NOW.toISOString() }, only, NOW);
    const aged = score(
      { ...base, publishedAt: new Date(NOW.getTime() - 36 * 3_600_000).toISOString() },
      only,
      NOW,
    );
    expect(fresh).toBeCloseTo(1, 3);
    expect(aged).toBeCloseTo(0.5, 3);
  });

  it('does not reward a date in the future', () => {
    const future = { ...base, publishedAt: '2026-09-20T00:00:00.000Z' };
    const present = { ...base, publishedAt: NOW.toISOString() };
    expect(score(future, interests, NOW)).toBe(score(present, interests, NOW));
  });

  it('ranks a heavier topic above a lighter one', () => {
    const heavy = score({ ...base, topics: ['ai-agents'] }, interests, NOW);
    const light = score({ ...base, topics: ['security'] }, interests, NOW);
    expect(heavy).toBeGreaterThan(light);
  });

  it('adds a little for a second topic, and ignores unknown topics', () => {
    const one = score({ ...base, topics: ['ai-agents'] }, interests, NOW);
    const two = score({ ...base, topics: ['ai-agents', 'databases'] }, interests, NOW);
    const unknown = score({ ...base, topics: ['ai-agents', 'gardening'] }, interests, NOW);
    expect(two).toBeGreaterThan(one);
    expect(unknown).toBe(one);
  });

  it('weighs the primary topic in full and the best other topic in part', () => {
    const led = score({ ...base, topics: ['ai-agents', 'security'] }, interests, NOW);
    const trailed = score({ ...base, topics: ['security', 'ai-agents'] }, interests, NOW);
    // A security story that mentions agents is still a security story.
    expect(led).toBeGreaterThan(trailed);
    expect(trailed).toBeCloseTo(score({ ...base, topics: ['security'] }, interests, NOW) + 0.25, 3);
  });

  it('uses the weight of the source id, then of the source kind', () => {
    const known = score(base, interests, NOW);
    const unknownFeed = score(
      { ...base, source: { id: 'other', name: 'Other', kind: 'feed' } },
      interests,
      NOW,
    );
    const arxiv = score(
      { ...base, source: { id: 'arxiv', name: 'arXiv', kind: 'arxiv' } },
      interests,
      NOW,
    );
    expect(known).toBeGreaterThan(unknownFeed);
    expect(unknownFeed).toBeGreaterThan(arxiv);
  });

  it('is rounded, so stored files do not churn on float noise', () => {
    const value = score({ ...base, points: 321 }, interests, NOW);
    expect(value).toBe(Number(value.toFixed(3)));
  });
});

describe('hard excludes', () => {
  it.each([
    ['a blocked phrase in the title', item({ title: 'Bitcoin price hits a new high' })],
    ['a blocked phrase in any case', item({ title: 'WE ARE HIRING a staff engineer' })],
    ['a listicle', item({ title: 'Top 10 VS Code extensions' })],
    ['a blocked domain', item({ canonicalUrl: 'https://medium.com/@someone/post' })],
    ['a subdomain of a blocked domain', item({ canonicalUrl: 'https://blog.spam.example/x' })],
  ])('scores zero for %s', (_name, excluded) => {
    expect(exclusionReason(excluded, interests)).not.toBeNull();
    expect(score({ ...excluded, points: 10_000, topics: ['ai-agents'] }, interests, NOW)).toBe(0);
  });

  it('does not block a domain that only ends with the same letters', () => {
    expect(
      exclusionReason(item({ canonicalUrl: 'https://notmedium.com/x' }), interests),
    ).toBeNull();
  });

  it('does not block a phrase inside another word', () => {
    expect(exclusionReason(item({ title: 'Laptop 100 review' }), interests)).toBeNull();
  });

  it('names the reason', () => {
    expect(exclusionReason(item({ title: 'Top 10 tips' }), interests)).toBe('blocked term: top 10');
    expect(exclusionReason(item({ canonicalUrl: 'https://medium.com/x' }), interests)).toBe(
      'blocked domain: medium.com',
    );
  });
});
