import { describe, expect, it } from 'vitest';
import { newsDigestSchema, rollup, type NewsItem } from '@/core/news';
import { day, item } from './helpers';

let counter = 0;
function entry(score: number, topics: string[]): NewsItem {
  counter += 1;
  return item({
    id: counter.toString(16).padStart(16, '0'),
    canonicalUrl: `https://example.com/r/${counter}`,
    score,
    topics,
  });
}

const monday = day('2026-09-14', [entry(3, ['ai-agents']), entry(1, ['databases'])]);
const tuesday = day('2026-09-15', [entry(5, ['ai-agents', 'security']), entry(2, ['security'])]);
const thursday = day('2026-09-17', [entry(4, ['ai-agents']), entry(2.5, ['web-platform'])]);
const nextWeek = day('2026-09-21', [entry(9, ['databases'])]);

describe('rollup', () => {
  it('returns null when there is nothing to roll up', () => {
    expect(rollup([], 'week')).toBeNull();
  });

  it('builds a schema-valid week from the days of the latest week', () => {
    const digest = rollup([thursday, monday, tuesday], 'week');
    expect(newsDigestSchema.safeParse(digest).success).toBe(true);
    expect(digest?.period).toBe('week');
    expect(digest?.key).toBe('2026-W38');
    expect(digest?.from).toBe('2026-09-14');
    expect(digest?.to).toBe('2026-09-20');
    expect(digest?.days).toEqual(['2026-09-14', '2026-09-15', '2026-09-17']);
    expect(digest?.itemCount).toBe(6);
    expect(digest?.generatedAt).toBe('2026-09-17T05:30:00.000Z');
  });

  it('ignores days outside the period of the latest day', () => {
    const digest = rollup([monday, nextWeek], 'week');
    expect(digest?.key).toBe('2026-W39');
    expect(digest?.days).toEqual(['2026-09-21']);
    expect(rollup([monday, nextWeek], 'month')?.days).toEqual(['2026-09-14', '2026-09-21']);
  });

  it('can be pinned to a period that is not the latest', () => {
    expect(rollup([monday, nextWeek], 'week', '2026-W38')?.days).toEqual(['2026-09-14']);
    expect(rollup([monday], 'week', '2026-W01')).toBeNull();
  });

  it('lists the top items by score', () => {
    const digest = rollup([monday, tuesday, thursday], 'week');
    expect(digest?.topItems.map((top) => top.score)).toEqual([5, 4, 3, 2.5, 2, 1]);
  });

  it('caps the top items: 10 for a week, 20 for a month', () => {
    const busy = Array.from({ length: 7 }, (_, d) =>
      day(
        `2026-09-${String(14 + d).padStart(2, '0')}`,
        Array.from({ length: 4 }, () => entry(1, ['security'])),
      ),
    );
    expect(rollup(busy, 'week')?.topItems).toHaveLength(10);
    expect(rollup(busy, 'month')?.topItems).toHaveLength(20);
  });

  it('lists an item once even when two days carry it', () => {
    const repeat = entry(7, ['security']);
    const digest = rollup([day('2026-09-14', [repeat]), day('2026-09-15', [repeat])], 'week');
    expect(digest?.itemCount).toBe(1);
    expect(digest?.topItems).toHaveLength(1);
  });

  it('counts every topic of every item, most frequent first', () => {
    const digest = rollup([monday, tuesday, thursday], 'week');
    expect(digest?.topicCounts).toEqual([
      { topic: 'ai-agents', count: 3 },
      { topic: 'security', count: 2 },
      { topic: 'databases', count: 1 },
      { topic: 'web-platform', count: 1 },
    ]);
  });

  it('names the threads: topics that came back on several days', () => {
    const digest = rollup([monday, tuesday, thursday], 'week');
    expect(digest?.threads.map((thread) => [thread.topic, thread.days])).toEqual([
      ['ai-agents', 3],
    ]);
    expect(digest?.threads[0]?.itemIds).toHaveLength(3);
  });

  it('asks more of a thread in a month than in a week', () => {
    const twoDays = [monday, tuesday];
    expect(rollup(twoDays, 'week')?.threads.map((t) => t.topic)).toEqual(['ai-agents']);
    expect(rollup(twoDays, 'month')?.threads).toEqual([]);
  });
});
