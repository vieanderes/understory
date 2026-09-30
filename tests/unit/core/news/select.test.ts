import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION, selectDay, type NewsItem } from '@/core/news';
import { item } from './helpers';

let counter = 0;
function scored(score: number, topic: string, sourceId = `feed-${(counter += 1)}`): NewsItem {
  counter += 1;
  return item({
    id: counter.toString(16).padStart(16, '0'),
    canonicalUrl: `https://example.com/${counter}`,
    topics: [topic],
    score,
    source: { id: sourceId, name: sourceId, kind: 'feed' },
  });
}

describe('selectDay', () => {
  it('has the documented defaults', () => {
    expect(DEFAULT_SELECTION).toEqual({ max: 12, perTopicMax: 4, perSourceMax: 5, minScore: 0 });
  });

  it('returns the best items first and never more than max', () => {
    const pool = Array.from({ length: 30 }, (_, i) => scored(i + 1, `topic-${i % 10}`));
    const picked = selectDay(pool);
    expect(picked).toHaveLength(12);
    expect(picked.map((p) => p.score)).toEqual(
      [...picked.map((p) => p.score)].sort((a, b) => b - a),
    );
    expect(picked[0]?.score).toBe(30);
  });

  it('stops one topic from filling the day', () => {
    const flood = Array.from({ length: 20 }, (_, i) => scored(100 - i, 'ai-agents'));
    const rest = Array.from({ length: 6 }, (_, i) => scored(10 - i, `other-${i}`));
    const picked = selectDay([...flood, ...rest]);
    expect(picked.filter((p) => p.topics[0] === 'ai-agents')).toHaveLength(4);
    expect(picked).toHaveLength(10);
  });

  it('counts only the primary topic against the cap', () => {
    const pool = Array.from({ length: 6 }, (_, i) => ({
      ...scored(50 - i, `lead-${i}`),
      topics: [`lead-${i}`, 'ai-agents'],
    }));
    expect(selectDay(pool)).toHaveLength(6);
  });

  it('stops one source from filling the day', () => {
    const pool = Array.from({ length: 9 }, (_, i) => scored(50 - i, `topic-${i}`, 'hn'));
    expect(selectDay(pool)).toHaveLength(5);
  });

  it('honours custom limits', () => {
    const pool = Array.from({ length: 9 }, (_, i) => scored(50 - i, 'one'));
    expect(selectDay(pool, { max: 3, perTopicMax: 9 })).toHaveLength(3);
    expect(selectDay(pool, { perTopicMax: 2 })).toHaveLength(2);
  });

  it('drops excluded items, weak items and items outside every interest', () => {
    const excluded = scored(0, 'ai-agents');
    const weak = scored(0.4, 'ai-agents');
    const untopiced = { ...scored(9, 'x'), topics: [] };
    const good = scored(2, 'ai-agents');
    expect(selectDay([excluded, weak, untopiced, good], { minScore: 0.5 })).toEqual([good]);
  });

  it('breaks score ties by id, so a re-run picks the same items', () => {
    const a = { ...scored(5, 't1'), id: '000000000000000b' };
    const b = { ...scored(5, 't2'), id: '000000000000000a' };
    expect(selectDay([a, b]).map((p) => p.id)).toEqual(['000000000000000a', '000000000000000b']);
    expect(selectDay([b, a]).map((p) => p.id)).toEqual(['000000000000000a', '000000000000000b']);
  });

  it('does not mutate its input', () => {
    const pool = [scored(1, 'a'), scored(2, 'b')];
    const copy = [...pool];
    selectDay(pool);
    expect(pool).toEqual(copy);
  });
});
