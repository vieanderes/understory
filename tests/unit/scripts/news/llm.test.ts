import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileNewsStore } from '@/adapters/news-file';
import type { LlmBrief } from '@/core/news';
import { loadConfig, type SignalConfig } from '../../../../scripts/news/config';
import {
  createAnthropicSummariser,
  DEFAULT_MODEL,
  MAX_OUTPUT_TOKENS,
  parseBriefResponse,
} from '../../../../scripts/news/llm';
import { runPipeline, type PipelineDeps } from '../../../../scripts/news/pipeline';
import { feedSource } from '../../../../scripts/news/sources/feeds';
import { hnSource } from '../../../../scripts/news/sources/hn';
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

const POSTGRES = {
  id: 'postgresql',
  name: 'PostgreSQL News',
  url: 'https://www.postgresql.org/news.rss',
  weight: 0.7,
  topics: ['databases'],
};

const good: LlmBrief = {
  whatHappened:
    'The source reports a new release. The source does not say which versions are affected.',
  whyItMatters:
    'Anyone who runs this in production should read the release notes before upgrading.',
  keyConcepts: [
    {
      term: 'Query planner',
      explanation: 'The part of a database that chooses how to run a query.',
    },
    { term: 'Index', explanation: 'A sorted structure that lets the database find rows quickly.' },
  ],
  relatedLessons: ['db.indexes'],
  recallCards: [
    {
      front: 'What does a query planner use to choose a plan?',
      back: 'Table statistics and cost estimates.',
    },
  ],
  readingLevel: 'quick',
};

/** The shape of a Messages API response, reduced to what the pipeline reads. */
function message(text: string, stopReason = 'end_turn'): Response {
  return ok(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-test',
      content: [{ type: 'text', text }],
      stop_reason: stopReason,
      usage: { input_tokens: 900, output_tokens: 300 },
    }),
  );
}

const sources: Route[] = [
  { match: hostIs('hn.algolia.com'), respond: async () => ok(await fixture('hn-algolia.json')) },
  {
    match: hostIs('www.postgresql.org'),
    respond: async () => ok(await fixture('rss-postgresql.xml')),
  },
];

let root: string;
let config: SignalConfig;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'signal-llm-'));
  config = await loadConfig(REPO_ROOT);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function run(api: Route['respond'], max = 4) {
  const net = fakeFetch([...sources, { match: hostIs('api.anthropic.com'), respond: api }]);
  const http = { fetch: net.fetch, ...fakeSleep() };
  const deps: PipelineDeps = {
    ...http,
    store: new FileNewsStore(root),
    sources: [hnSource, feedSource(POSTGRES)],
    config,
    summariser: createAnthropicSummariser(http, {
      apiKey: 'test-key',
      model: 'claude-test',
      interests: config.interests,
      lessonIndex: config.lessonIndex,
    }),
    now: NOW,
    log: () => undefined,
  };
  const apiCalls = () => net.calls.filter((call) => hostIs('api.anthropic.com')(call.url));
  return { result: runPipeline(deps, { date: '2026-09-17', dryRun: true, max }), apiCalls };
}

describe('model-written briefs', () => {
  it('stores a valid answer as an llm brief with the model id', async () => {
    const { result, apiCalls } = run(() => message(JSON.stringify(good)));
    const { day, fallbacks } = await result;
    expect(fallbacks).toEqual({});
    expect(day.stats.llmBriefs).toBe(day.items.length);
    expect(day.items[0]?.brief).toEqual({ ...good, generatedBy: 'llm', model: 'claude-test' });
    expect(apiCalls()).toHaveLength(day.items.length);
  });

  it('sends one bounded request per item with only the allowed fields', async () => {
    const { result, apiCalls } = run(() => message(JSON.stringify(good)), 2);
    const { day } = await result;
    expect(apiCalls()).toHaveLength(2);

    const call = apiCalls()[0]!;
    const headers = call.init?.headers as Record<string, string>;
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.init?.method).toBe('POST');
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(String(call.init?.body));
    expect(body.model).toBe('claude-test');
    expect(body.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(body.max_tokens).toBeLessThanOrEqual(1_500);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.output_config.format.schema.properties.relatedLessons.items.enum).toContain(
      'db.indexes',
    );
    expect(body.system[0].text).toContain('British English');
    expect(body.system[0].text).toContain('the source does not say');
    expect(body.system[0].text).toContain('db.indexes: Indexes');

    const titles = day.items.map((item) => item.title);
    const sent = JSON.parse(body.messages[0].content);
    expect(Object.keys(sent).sort()).toEqual([
      'excerpt',
      'source',
      'sourceKind',
      'title',
      'topics',
    ]);
    expect(titles).toContain(sent.title);
    // No URL leaves the machine: the model cannot be tempted to "read" the article.
    expect(body.messages[0].content).not.toMatch(/https?:\/\//);
  });

  it('never has more than three requests in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const { result } = run(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return message(JSON.stringify(good));
    }, 8);
    const { day } = await result;
    expect(day.items.length).toBeGreaterThan(3);
    expect(peak).toBe(3);
  });

  it('falls back per item when the answer is not JSON', async () => {
    const { result } = run(() => message('Here is your brief: it is great'));
    const { day, fallbacks } = await result;
    expect(day.stats.llmBriefs).toBe(0);
    expect(day.stats.extractiveBriefs).toBe(day.items.length);
    expect(Object.keys(fallbacks)).toHaveLength(day.items.length);
    expect(day.items.every((item) => item.brief?.generatedBy === 'extractive')).toBe(true);
    expect(day.items.every((item) => item.brief?.model === undefined)).toBe(true);
  });

  it('falls back when the brief is over-long', async () => {
    const long = { ...good, whatHappened: 'word '.repeat(61).trim() };
    const { result } = run(() => message(JSON.stringify(long)));
    const { day, fallbacks } = await result;
    expect(day.stats.llmBriefs).toBe(0);
    expect(Object.values(fallbacks)[0]).toMatch(/whatHappened/);
  });

  it('falls back when the brief breaks the house rules', async () => {
    const cases: LlmBrief[] = [
      { ...good, whyItMatters: 'We think this is huge!' },
      { ...good, whyItMatters: 'Details at https://evil.example/login today.' },
      { ...good, relatedLessons: ['db.not-a-lesson'] },
      { ...good, keyConcepts: good.keyConcepts.slice(0, 1) },
    ];
    for (const broken of cases) {
      const { result } = run(() => message(JSON.stringify(broken)), 1);
      const { day, fallbacks } = await result;
      expect(day.items[0]?.brief?.generatedBy).toBe('extractive');
      expect(Object.keys(fallbacks)).toHaveLength(1);
    }
  });

  it('falls back on a refusal, a cut-off answer and an API error', async () => {
    const responses = [
      () => message('', 'refusal'),
      () => message(JSON.stringify(good).slice(0, 80), 'max_tokens'),
      () => status(401),
      () => ok('{"type":"error"}'),
    ];
    for (const respond of responses) {
      const { result } = run(respond, 1);
      expect((await result).day.items[0]?.brief?.generatedBy).toBe('extractive');
    }
  });

  it('mixes: one bad answer costs one item, not the run', async () => {
    let count = 0;
    const { result } = run(
      () => message((count += 1) === 2 ? 'not json' : JSON.stringify(good)),
      4,
    );
    const { day } = await result;
    expect(day.stats.llmBriefs).toBe(day.items.length - 1);
    expect(day.stats.extractiveBriefs).toBe(1);
  });

  it('does not pay twice: a stored llm brief is reused on a re-run', async () => {
    const net = fakeFetch([
      ...sources,
      { match: hostIs('api.anthropic.com'), respond: () => message(JSON.stringify(good)) },
    ]);
    const http = { fetch: net.fetch, ...fakeSleep() };
    const deps: PipelineDeps = {
      ...http,
      store: new FileNewsStore(root),
      sources: [hnSource, feedSource(POSTGRES)],
      config,
      summariser: createAnthropicSummariser(http, {
        apiKey: 'k',
        model: 'claude-test',
        interests: config.interests,
        lessonIndex: config.lessonIndex,
      }),
      now: NOW,
      log: () => undefined,
    };
    await runPipeline(deps, { date: '2026-09-17', dryRun: false, max: 3 });
    const before = net.calls.filter((call) => call.url.includes('anthropic')).length;
    await runPipeline(deps, { date: '2026-09-17', dryRun: false, max: 3 });
    expect(before).toBe(3);
    expect(net.calls.filter((call) => call.url.includes('anthropic')).length).toBe(3);
  });
});

describe('request details', () => {
  it('has a current default model', () => {
    expect(DEFAULT_MODEL).toMatch(/^claude-[a-z]+-\d/);
  });

  it('drops an empty recallCards array instead of storing it', () => {
    const body = JSON.stringify({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ ...good, recallCards: [] }) }],
    });
    expect(parseBriefResponse(body)).not.toHaveProperty('recallCards');
  });

  it('rejects provenance fields from the model: it cannot label itself', () => {
    const body = JSON.stringify({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ ...good, generatedBy: 'extractive' }) }],
    });
    expect(() => parseBriefResponse(body)).toThrow(/schema/);
  });

  it('throws when the response has no text block', () => {
    expect(() =>
      parseBriefResponse(JSON.stringify({ stop_reason: 'end_turn', content: [] })),
    ).toThrow(/no text/);
  });
});
