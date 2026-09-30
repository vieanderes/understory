import { describe, expect, it } from 'vitest';
import { DAY_ITEMS_HARD_CAP, mergeDay, type Brief } from '@/core/news';
import { day, item } from './helpers';

const extractive: Brief = {
  whatHappened: 'PostgreSQL News published a post.',
  whyItMatters: 'Databases limit most applications.',
  keyConcepts: [
    { term: 'Index', explanation: 'A sorted structure.' },
    { term: 'Query planner', explanation: 'Chooses a plan.' },
  ],
  relatedLessons: [],
  readingLevel: 'quick',
  generatedBy: 'extractive',
};
const llm: Brief = { ...extractive, generatedBy: 'llm', model: 'claude-test' };

describe('mergeDay', () => {
  it('returns the incoming day when nothing is stored', () => {
    const incoming = day('2026-09-17', [item()]);
    expect(mergeDay(null, incoming)).toEqual(incoming);
  });

  it('is idempotent: merging a day into itself changes nothing', () => {
    const stored = day('2026-09-17', [item({ brief: extractive, score: 2 })]);
    expect(mergeDay(stored, stored)).toEqual(stored);
  });

  it('merges by item id and keeps the stored brief', () => {
    const stored = day('2026-09-17', [item({ brief: llm, score: 2, points: 10 })]);
    const incoming = day('2026-09-17', [item({ brief: extractive, score: 2.4, points: 80 })]);
    const merged = mergeDay(stored, incoming);
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]?.brief).toEqual(llm);
    // Fresh numbers win: the story gained points since the first run.
    expect(merged.items[0]?.points).toBe(80);
    expect(merged.items[0]?.score).toBe(2.4);
  });

  it('lets a model-written brief replace an extractive one, never the reverse', () => {
    const stored = day('2026-09-17', [item({ brief: extractive })]);
    const incoming = day('2026-09-17', [item({ brief: llm })]);
    expect(mergeDay(stored, incoming).items[0]?.brief).toEqual(llm);
  });

  it('takes the incoming brief when the stored item has none', () => {
    const stored = day('2026-09-17', [item()]);
    const incoming = day('2026-09-17', [item({ brief: extractive })]);
    expect(mergeDay(stored, incoming).items[0]?.brief).toEqual(extractive);
  });

  it('keeps stored items a later run no longer finds, ordered by score', () => {
    const old = item({ id: '00000000000000a1', score: 1 });
    const fresh = item({ id: '00000000000000a2', score: 3 });
    const merged = mergeDay(day('2026-09-17', [old]), day('2026-09-17', [fresh]));
    expect(merged.items.map((i) => i.id)).toEqual(['00000000000000a2', '00000000000000a1']);
    expect(merged.stats.selected).toBe(2);
  });

  it('keeps the first fetch time of an item', () => {
    const stored = day('2026-09-17', [item({ fetchedAt: '2026-09-17T05:30:00.000Z' })]);
    const incoming = day('2026-09-17', [item({ fetchedAt: '2026-09-17T11:00:00.000Z' })]);
    expect(mergeDay(stored, incoming).items[0]?.fetchedAt).toBe('2026-09-17T05:30:00.000Z');
  });

  it('never grows past the hard cap', () => {
    const many = (offset: number) =>
      Array.from({ length: 20 }, (_, i) =>
        item({ id: (offset + i).toString(16).padStart(16, '0'), score: offset + i }),
      );
    const merged = mergeDay(day('2026-09-17', many(1)), day('2026-09-17', many(100)));
    expect(merged.items).toHaveLength(DAY_ITEMS_HARD_CAP);
    expect(merged.items[0]?.score).toBe(119);
  });

  it('counts briefs by how they were made', () => {
    const stored = day('2026-09-17', [item({ id: '00000000000000a1', brief: llm })]);
    const incoming = day('2026-09-17', [item({ id: '00000000000000a2', brief: extractive })]);
    const { stats } = mergeDay(stored, incoming);
    expect(stats.llmBriefs).toBe(1);
    expect(stats.extractiveBriefs).toBe(1);
  });

  it('refuses to merge two different dates', () => {
    expect(() => mergeDay(day('2026-09-16', []), day('2026-09-17', []))).toThrow(/2026-09-16/);
  });
});
