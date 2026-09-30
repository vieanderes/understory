import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileNewsStore } from '@/adapters/news-file';
import { newsDaySchema, validateBrief } from '@/core/news';
import { loadConfig, type SignalConfig } from '../../../../scripts/news/config';
import {
  AllSourcesFailedError,
  runPipeline,
  type PipelineDeps,
} from '../../../../scripts/news/pipeline';
import { arxivSource } from '../../../../scripts/news/sources/arxiv';
import { feedSource } from '../../../../scripts/news/sources/feeds';
import { hnSource } from '../../../../scripts/news/sources/hn';
import { validateNewsData } from '../../../../scripts/news/validate';
import {
  fakeFetch,
  fakeSleep,
  fixture,
  hostIs,
  NOW,
  ok,
  REPO_ROOT,
  status,
  type Route,
} from './helpers';

const FEEDS = [
  {
    id: 'postgresql',
    name: 'PostgreSQL News',
    url: 'https://www.postgresql.org/news.rss',
    weight: 0.7,
    topics: ['databases'],
  },
  {
    id: 'deno',
    name: 'Deno Blog',
    url: 'https://deno.com/feed',
    weight: 0.65,
    topics: ['web-platform'],
  },
];

const recorded: Route[] = [
  { match: hostIs('hn.algolia.com'), respond: async () => ok(await fixture('hn-algolia.json')) },
  { match: hostIs('export.arxiv.org'), respond: async () => ok(await fixture('arxiv.atom.xml')) },
  {
    match: hostIs('www.postgresql.org'),
    respond: async () => ok(await fixture('rss-postgresql.xml')),
  },
  { match: hostIs('deno.com'), respond: async () => ok(await fixture('atom-deno.xml')) },
];

let root: string;
let config: SignalConfig;
let lines: string[];

function deps(routes: readonly Route[], overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    ...fakeFetch(routes),
    ...fakeSleep(),
    store: new FileNewsStore(root),
    sources: [hnSource, arxivSource, ...FEEDS.map(feedSource)],
    config,
    summariser: null,
    now: NOW,
    log: (line) => lines.push(line),
    ...overrides,
  };
}

const options = { date: '2026-09-17', dryRun: false, max: 12 };

async function filesUnder(dir: string): Promise<string[]> {
  return (await readdir(dir, { recursive: true })).filter((file) => file.endsWith('.json')).sort();
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'signal-run-'));
  config = await loadConfig(REPO_ROOT);
  lines = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('pipeline over recorded fixtures', () => {
  it('dry run: builds a valid day and writes nothing', async () => {
    const result = await runPipeline(deps(recorded), { ...options, dryRun: true });
    expect(result.written).toBe(false);
    expect(await filesUnder(root)).toEqual([]);

    const { day } = result;
    expect(newsDaySchema.safeParse(day).success).toBe(true);
    expect(day.date).toBe('2026-09-17');
    expect(day.generatedAt).toBe(NOW.toISOString());
    expect(day.items.length).toBeGreaterThan(3);
    expect(day.items.length).toBeLessThanOrEqual(12);
    expect(day.stats.sources.map((source) => [source.id, source.ok])).toEqual([
      ['hn', true],
      ['arxiv', true],
      ['postgresql', true],
      ['deno', true],
    ]);
    expect(day.stats.fetched).toBeGreaterThan(day.stats.afterDedupe - 1);
  });

  it('gives every item topics, a score and a valid extractive brief', async () => {
    const { day } = await runPipeline(deps(recorded), { ...options, dryRun: true });
    for (const item of day.items) {
      expect(item.topics.length).toBeGreaterThan(0);
      expect(item.score).toBeGreaterThanOrEqual(config.interests.minScore);
      expect(item.brief?.generatedBy).toBe('extractive');
      expect(validateBrief(item.brief!, item, config.lessonIndex)).toEqual({ ok: true });
    }
    expect(day.stats.extractiveBriefs).toBe(day.items.length);
    expect(day.stats.llmBriefs).toBe(0);
  });

  it('orders by score and keeps old feed entries out', async () => {
    const { day } = await runPipeline(deps(recorded), { ...options, dryRun: true });
    const scores = day.items.map((item) => item.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    // The Deno fixture ends in June and two PostgreSQL entries are a week old.
    expect(day.items.some((item) => item.source.id === 'deno')).toBe(false);
    expect(day.items.map((item) => item.title)).not.toContain(
      'CERN PGDay 2027: Announcement and CfP',
    );
  });

  it('stores only a capped excerpt, never a body', async () => {
    const { day } = await runPipeline(deps(recorded), { ...options, dryRun: true });
    const paper = day.items.find((item) => item.source.kind === 'arxiv');
    expect(paper?.excerpt?.length).toBeLessThanOrEqual(280);
    expect(JSON.stringify(day)).not.toContain('<p>');
  });

  it('honours --max', async () => {
    const { day } = await runPipeline(deps(recorded), { ...options, dryRun: true, max: 2 });
    expect(day.items).toHaveLength(2);
  });

  it('writes the day, the index and both roll-ups, and the files validate', async () => {
    const result = await runPipeline(deps(recorded), options);
    expect(result.written).toBe(true);
    expect(await filesUnder(root)).toEqual([
      '2026/09/17.json',
      'digests/month/2026-09.json',
      'digests/week/2026-W38.json',
      'index.json',
    ]);
    expect(await validateNewsData(root)).toEqual([]);
    const week = await new FileNewsStore(root).digest('week', '2026-W38');
    expect(week?.itemCount).toBe(result.day.items.length);
  });

  it('is idempotent: a second run leaves the same items and briefs', async () => {
    await runPipeline(deps(recorded), options);
    const first = await new FileNewsStore(root).day('2026-09-17');
    await runPipeline(deps(recorded), options);
    const second = await new FileNewsStore(root).day('2026-09-17');
    expect(second?.items).toEqual(first?.items);
  });

  it('does not show an item again that an earlier day carried', async () => {
    const yesterday = await runPipeline(deps(recorded), { ...options, date: '2026-09-16' });
    const today = await runPipeline(deps(recorded), options);
    const shown = new Set(yesterday.day.items.map((item) => item.id));
    expect(today.day.items.filter((item) => shown.has(item.id))).toEqual([]);
  });

  it('reports a failed source and carries on', async () => {
    const routes = recorded.map((route, index) =>
      index === 1 ? { ...route, respond: () => status(503) } : route,
    );
    const { day } = await runPipeline(deps(routes), { ...options, dryRun: true });
    const arxiv = day.stats.sources.find((source) => source.id === 'arxiv');
    expect(arxiv).toEqual({
      id: 'arxiv',
      ok: false,
      count: 0,
      error: expect.stringContaining('503'),
    });
    expect(day.items.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.includes('source arxiv failed'))).toBe(true);
  });

  it('treats a page that is not a feed as a failed source', async () => {
    const routes = recorded.map((route, index) =>
      index === 3 ? { ...route, respond: () => ok('<html>Just a moment...</html>') } : route,
    );
    const { day } = await runPipeline(deps(routes), { ...options, dryRun: true });
    expect(day.stats.sources.find((source) => source.id === 'deno')?.ok).toBe(false);
  });

  it('fails closed when every source fails: throws and writes nothing', async () => {
    const down: Route[] = [{ match: () => true, respond: () => status(500) }];
    await expect(runPipeline(deps(down), options)).rejects.toBeInstanceOf(AllSourcesFailedError);
    expect(await filesUnder(root)).toEqual([]);
  });

  it('writes nothing on a day when no item passes selection', async () => {
    const quiet: Route[] = [
      { match: hostIs('deno.com'), respond: async () => ok(await fixture('atom-deno.xml')) },
    ];
    const result = await runPipeline(deps(quiet, { sources: [feedSource(FEEDS[1]!)] }), options);
    expect(result.written).toBe(false);
    expect(await filesUnder(root)).toEqual([]);
  });

  it('works with a store that keeps no roll-ups', async () => {
    const full = new FileNewsStore(root);
    const daysOnly = {
      day: full.day.bind(full),
      range: full.range.bind(full),
      latestDate: full.latestDate.bind(full),
      putDay: full.putDay.bind(full),
    };
    const result = await runPipeline(deps(recorded, { store: daysOnly }), options);
    expect(result.written).toBe(true);
    expect(await filesUnder(root)).toEqual(['2026/09/17.json', 'index.json']);
  });
});
