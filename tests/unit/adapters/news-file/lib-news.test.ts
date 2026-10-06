import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileNewsStore } from '@/adapters/news-file';
import type { NewsDay, NewsItem } from '@/core/news';
import { getDay, getLatestDay, getMonth, getWeek, listDates, listEditions } from '@/lib/news';

function item(id: string, score: number, topic: string): NewsItem {
  return {
    id,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    title: `Story ${id}`,
    source: { id: 'postgres', name: 'PostgreSQL News', kind: 'feed' },
    publishedAt: '2026-09-17T00:00:00.000Z',
    fetchedAt: '2026-09-17T05:30:00.000Z',
    topics: [topic],
    score,
  };
}

function day(date: string, items: NewsItem[]): NewsDay {
  return {
    date,
    generatedAt: `${date}T05:30:00.000Z`,
    items,
    stats: {
      fetched: 0,
      afterDedupe: 0,
      excluded: 0,
      selected: items.length,
      llmBriefs: 0,
      extractiveBriefs: 0,
      sources: [],
    },
  };
}

let root: string;
const previous = process.env.NEWS_DATA_DIR;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'signal-lib-'));
  process.env.NEWS_DATA_DIR = root;
});

afterEach(async () => {
  if (previous === undefined) delete process.env.NEWS_DATA_DIR;
  else process.env.NEWS_DATA_DIR = previous;
  await rm(root, { recursive: true, force: true });
});

describe('news getters', () => {
  it('return null and empty lists before the first run', async () => {
    expect(await getLatestDay()).toBeNull();
    expect(await getDay('2026-09-17')).toBeNull();
    expect(await getWeek('2026-W38')).toBeNull();
    expect(await getMonth('2026-09')).toBeNull();
    expect(await listDates()).toEqual([]);
    expect(await listEditions()).toEqual([]);
  });

  it('read what the pipeline wrote', async () => {
    const store = new FileNewsStore(root);
    await store.putDay(day('2026-08-31', [item('00000000000000a0', 1, 'security')]));
    await store.putDay(day('2026-09-15', [item('00000000000000a1', 2, 'databases')]));
    await store.putDay(day('2026-09-17', [item('00000000000000a2', 3, 'databases')]));

    expect(await listDates()).toEqual(['2026-09-17', '2026-09-15', '2026-08-31']);
    expect((await getLatestDay())?.date).toBe('2026-09-17');
    expect((await getDay('2026-09-15'))?.items[0]?.id).toBe('00000000000000a1');

    const week = await getWeek('2026-W38');
    expect(week?.days).toEqual(['2026-09-15', '2026-09-17']);
    expect(week?.threads.map((thread) => thread.topic)).toEqual(['databases']);

    const month = await getMonth('2026-09');
    expect(month?.itemCount).toBe(2);
    expect((await getMonth('2026-08'))?.days).toEqual(['2026-08-31']);
  });

  it('list every edition newest first with its lead story', async () => {
    const store = new FileNewsStore(root);
    await store.putDay(day('2026-09-15', [item('00000000000000a1', 2, 'databases')]));
    await store.putDay(
      day('2026-09-17', [
        item('00000000000000a2', 3, 'databases'),
        item('00000000000000a3', 1, 'security'),
      ]),
    );
    expect(await listEditions()).toEqual([
      { date: '2026-09-17', lead: 'Story 00000000000000a2', count: 2 },
      { date: '2026-09-15', lead: 'Story 00000000000000a1', count: 1 },
    ]);
  });

  it('treat malformed route params as not found', async () => {
    expect(await getDay('../../secrets')).toBeNull();
    expect(await getDay('17-09-2026')).toBeNull();
    expect(await getWeek('2026-38')).toBeNull();
    expect(await getMonth('2026-13')).toBeNull();
  });
});
