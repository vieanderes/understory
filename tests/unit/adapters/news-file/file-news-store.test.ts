import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileNewsStore } from '@/adapters/news-file';
import { rollup, type Brief, type NewsDay, type NewsItem } from '@/core/news';

const brief: Brief = {
  whatHappened: 'PostgreSQL News published "PostgreSQL 19 Released".',
  whyItMatters: 'Most applications are limited by their database.',
  keyConcepts: [
    { term: 'Index', explanation: 'A sorted structure for finding rows.' },
    { term: 'Query planner', explanation: 'Chooses how to run a query.' },
  ],
  relatedLessons: ['db.indexes'],
  readingLevel: 'quick',
  generatedBy: 'extractive',
};

function item(id: string, score: number, extra: Partial<NewsItem> = {}): NewsItem {
  return {
    id,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    title: `Story ${id}`,
    source: { id: 'postgres', name: 'PostgreSQL News', kind: 'feed' },
    publishedAt: '2026-09-17T00:00:00.000Z',
    fetchedAt: '2026-09-17T05:30:00.000Z',
    topics: ['databases'],
    score,
    brief,
    ...extra,
  };
}

function day(date: string, items: NewsItem[]): NewsDay {
  return {
    date,
    generatedAt: `${date}T05:30:00.000Z`,
    items,
    stats: {
      fetched: 40,
      afterDedupe: 35,
      excluded: 1,
      selected: items.length,
      llmBriefs: 0,
      extractiveBriefs: items.length,
      sources: [{ id: 'postgres', ok: true, count: 40 }],
    },
  };
}

let root: string;
let store: FileNewsStore;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'signal-store-'));
  store = new FileNewsStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('FileNewsStore', () => {
  it('is empty before the first run', async () => {
    expect(await store.latestDate()).toBeNull();
    expect(await store.day('2026-09-17')).toBeNull();
    expect(await store.range('2026-09-01', '2026-09-30')).toEqual([]);
    expect(await store.listDates()).toEqual([]);
  });

  it('writes a day to YYYY/MM/DD.json and reads it back', async () => {
    const written = day('2026-09-17', [item('00000000000000a1', 2)]);
    await store.putDay(written);
    expect(await store.day('2026-09-17')).toEqual(written);
    const file = await readFile(path.join(root, '2026', '09', '17.json'), 'utf8');
    expect(file.endsWith('}\n')).toBe(true);
    expect(file).toContain('\n  "date": "2026-09-17",\n');
  });

  it('keeps an index of dates, newest first', async () => {
    await store.putDay(day('2026-09-16', []));
    await store.putDay(day('2026-09-17', []));
    await store.putDay(day('2026-08-31', []));
    expect(await store.listDates()).toEqual(['2026-09-17', '2026-09-16', '2026-08-31']);
    expect(await store.latestDate()).toBe('2026-09-17');
    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    expect(index).toEqual({ dates: ['2026-09-17', '2026-09-16', '2026-08-31'] });
  });

  it('returns a range oldest first and skips missing days', async () => {
    await store.putDay(day('2026-09-17', []));
    await store.putDay(day('2026-09-14', []));
    await store.putDay(day('2026-09-21', []));
    const range = await store.range('2026-09-14', '2026-09-20');
    expect(range.map((d) => d.date)).toEqual(['2026-09-14', '2026-09-17']);
  });

  it('is idempotent: writing the same day twice leaves the same bytes', async () => {
    const written = day('2026-09-17', [item('00000000000000a1', 2), item('00000000000000a2', 1)]);
    await store.putDay(written);
    const first = await readFile(path.join(root, '2026', '09', '17.json'), 'utf8');
    await store.putDay(written);
    expect(await readFile(path.join(root, '2026', '09', '17.json'), 'utf8')).toBe(first);
    expect(await store.listDates()).toEqual(['2026-09-17']);
  });

  it('writes keys in one order whatever order the caller used', async () => {
    const tidy = day('2026-09-17', [item('00000000000000a1', 2)]);
    await store.putDay(tidy);
    const first = await readFile(path.join(root, '2026', '09', '17.json'), 'utf8');

    const other = new FileNewsStore(await mkdtemp(path.join(tmpdir(), 'signal-store-')));
    const shuffledItem = Object.fromEntries(Object.entries(tidy.items[0]!).reverse()) as NewsItem;
    const shuffled = Object.fromEntries(
      Object.entries({ ...tidy, items: [shuffledItem] }).reverse(),
    ) as NewsDay;
    await other.putDay(shuffled);
    expect(await readFile(path.join(other.root, '2026', '09', '17.json'), 'utf8')).toBe(first);
    await rm(other.root, { recursive: true, force: true });
  });

  it('merges a re-run by item id and keeps the stored brief', async () => {
    const llm: Brief = { ...brief, generatedBy: 'llm', model: 'claude-test' };
    await store.putDay(
      day('2026-09-17', [item('00000000000000a1', 2, { brief: llm, points: 10 })]),
    );
    await store.putDay(
      day('2026-09-17', [
        item('00000000000000a1', 2.5, { points: 90 }),
        item('00000000000000a2', 3),
      ]),
    );
    const merged = await store.day('2026-09-17');
    expect(merged?.items.map((i) => i.id)).toEqual(['00000000000000a2', '00000000000000a1']);
    expect(merged?.items[1]?.brief).toEqual(llm);
    expect(merged?.items[1]?.points).toBe(90);
  });

  it('refuses to write a day that fails the schema, and writes nothing', async () => {
    const bad = day('2026-09-17', [item('not-a-hash', 2)]);
    await expect(store.putDay(bad)).rejects.toThrow(/2026-09-17/);
    expect(await store.listDates()).toEqual([]);
    expect(await store.day('2026-09-17')).toBeNull();
  });

  it('fails loudly on a stored file that is not a valid day', async () => {
    await mkdir(path.join(root, '2026', '09'), { recursive: true });
    await writeFile(path.join(root, '2026', '09', '17.json'), '{"date":"2026-09-17"}');
    await expect(store.day('2026-09-17')).rejects.toThrow(/17\.json/);
  });

  it('rejects a date that could escape the data folder', async () => {
    await expect(store.day('../../etc/passwd')).rejects.toThrow();
  });

  it('rebuilds the index from the files when the index is missing', async () => {
    await store.putDay(day('2026-09-16', []));
    await store.putDay(day('2026-09-17', []));
    await rm(path.join(root, 'index.json'));
    expect(await store.listDates()).toEqual(['2026-09-17', '2026-09-16']);
  });

  it('stores and reads roll-ups', async () => {
    const days = [
      day('2026-09-16', [item('00000000000000a1', 2)]),
      day('2026-09-17', [item('00000000000000a2', 3)]),
    ];
    const week = rollup(days, 'week');
    const month = rollup(days, 'month');
    expect(week).not.toBeNull();
    expect(month).not.toBeNull();
    await store.putDigest(week!);
    await store.putDigest(month!);
    expect(await store.digest('week', '2026-W38')).toEqual(week);
    expect(await store.digest('month', '2026-09')).toEqual(month);
    expect(await store.digest('week', '2026-W01')).toBeNull();
    expect(await store.listDigestKeys('week')).toEqual(['2026-W38']);
    expect(await store.listDigestKeys('month')).toEqual(['2026-09']);
    await expect(store.digest('week', '../x')).rejects.toThrow();
    // Roll-ups must not show up as days.
    expect(await store.listDates()).toEqual([]);
  });
});
