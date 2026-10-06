import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlannerCourse } from '@/adapters/assistant/server/planner-course';
import { BODY, jsonRequest, readAll } from './fixtures';

const create = vi.fn();
const constructed: unknown[] = [];

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class FakeAnthropic {
    messages = { create };
    constructor(options: unknown) {
      constructed.push(options);
    }
  }
  return { ...actual, default: FakeAnthropic };
});

const sdk = await import('@anthropic-ai/sdk');
const { POST } = await import('@/app/api/assistant/route');

const URL = 'http://localhost:3000/api/assistant';

async function* events(items: unknown[]) {
  for (const item of items) yield item;
}

const delta = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'text_delta', text },
});

beforeEach(() => {
  create.mockReset();
  constructed.length = 0;
  forgetPlannerCourse();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/assistant', () => {
  it('refuses a request without a key before calling Anthropic', async () => {
    const response = await POST(jsonRequest(URL, BODY));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'unauthorised', message: expect.stringContaining('API key') },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('answers 400 for a malformed body', async () => {
    const response = await POST(jsonRequest(URL, { turns: [] }, { 'x-anthropic-key': 'sk-1' }));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses a model outside the allowlist', async () => {
    const response = await POST(
      jsonRequest(URL, { ...BODY, model: 'gpt-5' }, { 'x-anthropic-key': 'sk-1' }),
    );
    expect(response.status).toBe(400);
  });

  it('streams text deltas as NDJSON and ends with done', async () => {
    create.mockResolvedValue(
      events([
        { type: 'message_start' },
        delta('A run is '),
        delta('a streak.'),
        { type: 'message_stop' },
      ]),
    );
    const response = await POST(jsonRequest(URL, BODY, { 'x-anthropic-key': 'sk-secret' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(await readAll(response.body)).toEqual([
      { type: 'text', text: 'A run is ' },
      { type: 'text', text: 'a streak.' },
      { type: 'done' },
    ]);

    expect(constructed[0]).toMatchObject({ apiKey: 'sk-secret' });
    const [params] = create.mock.calls[0]!;
    expect(params).toMatchObject({
      model: 'claude-sonnet-5-5',
      stream: true,
      messages: [{ role: 'user', content: 'What does a run mean here?' }],
    });
    expect(params.system).toContain('Longest run');
  });

  it('uses an allowed model when asked for one', async () => {
    create.mockResolvedValue(events([]));
    await POST(
      jsonRequest(URL, { ...BODY, model: 'claude-haiku-4-5-20251001' }, { 'x-anthropic-key': 'k' }),
    );
    expect(create.mock.calls[0]![0].model).toBe('claude-haiku-4-5-20251001');
  });

  it.each([
    [new sdk.AuthenticationError(401, {}, 'bad key', new Headers()), 401, 'unauthorised'],
    [new sdk.RateLimitError(429, {}, 'slow down', new Headers()), 429, 'rate-limited'],
    [new sdk.InternalServerError(529, {}, 'overloaded', new Headers()), 503, 'unavailable'],
    [new sdk.InternalServerError(500, {}, 'boom', new Headers()), 502, 'failed'],
  ])('maps an SDK error before streaming to a status', async (error, status, code) => {
    create.mockRejectedValue(error);
    const response = await POST(jsonRequest(URL, BODY, { 'x-anthropic-key': 'sk-secret' }));
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain('sk-secret');
  });

  it('reports an error mid-stream as an error event', async () => {
    create.mockResolvedValue(
      (async function* () {
        yield delta('Half');
        throw new sdk.InternalServerError(500, {}, 'gone', new Headers());
      })(),
    );
    const response = await POST(jsonRequest(URL, BODY, { 'x-anthropic-key': 'k' }));
    expect(await readAll(response.body)).toEqual([
      { type: 'text', text: 'Half' },
      { type: 'error', code: 'failed', message: expect.any(String) },
    ]);
  });

  it('plans with the course from its own origin, cached as one block, and room for a path', async () => {
    const course = vi.fn(async (url: string) => {
      expect(url).toBe('http://localhost:3000/api/planner/course');
      return Response.json({ catalog: '# The course\n- web.http | HTTP' });
    });
    vi.stubGlobal('fetch', course);
    create.mockResolvedValue(events([]));
    const planner = {
      ...BODY,
      context: { ...BODY.context, mode: 'planner', planner: 'Today is 2026-10-06.' },
    };
    await POST(jsonRequest(URL, planner, { 'x-anthropic-key': 'k' }));
    await POST(jsonRequest(URL, planner, { 'x-anthropic-key': 'k' }));
    expect(course).toHaveBeenCalledTimes(1);
    const [params] = create.mock.calls[0]!;
    expect(params.max_tokens).toBe(8192);
    expect(params.system).toHaveLength(2);
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(params.system[0].text).toContain('```scout-path');
    expect(params.system[0].text).toContain('- web.http | HTTP');
    expect(params.system[1].text).toContain('Today is 2026-10-06.');
  });

  it('keeps the plain prompt and token budget outside the planner', async () => {
    create.mockResolvedValue(events([]));
    await POST(jsonRequest(URL, BODY, { 'x-anthropic-key': 'k' }));
    const [params] = create.mock.calls[0]!;
    expect(params.max_tokens).toBe(4096);
    expect(typeof params.system).toBe('string');
  });
});
