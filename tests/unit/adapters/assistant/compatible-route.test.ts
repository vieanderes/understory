import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlannerCourse } from '@/adapters/assistant/server/planner-course';
import { BODY, jsonRequest, readAll } from './fixtures';
import { POST } from '@/app/api/assistant/compatible/route';

const URL = 'http://localhost:3000/api/assistant/compatible';
const BASE_URL = 'https://api.openai.com/v1';

function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
}

beforeEach(() => {
  forgetPlannerCourse();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/assistant/compatible', () => {
  it('refuses a request without x-base-url header', async () => {
    const response = await POST(jsonRequest(URL, BODY));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'unavailable', message: expect.stringContaining('base URL') },
    });
  });

  it('answers 400 for a malformed body', async () => {
    const response = await POST(jsonRequest(URL, { turns: [] }, { 'x-base-url': BASE_URL }));
    expect(response.status).toBe(400);
  });

  it('forwards request to provider completions endpoint and streams NDJSON', async () => {
    const sse = ['data: {"choices":[{"delta":{"content":"Hi there"}}]}', '', 'data: [DONE]'];

    const fetchMock = vi.fn(async () => {
      return new Response(sseStream(sse), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      jsonRequest(
        URL,
        { ...BODY, model: 'gpt-4o' },
        { 'x-base-url': BASE_URL, 'x-api-key': 'sk-secret' },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(await readAll(response.body)).toEqual([
      { type: 'text', text: 'Hi there' },
      { type: 'done' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-secret');
    const sentBody = JSON.parse(String(init.body));
    expect(sentBody.model).toBe('gpt-4o');
    expect(sentBody.stream).toBe(true);
    expect(sentBody.messages[0].role).toBe('system');
  });

  it('maps HTTP errors from the upstream provider', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      jsonRequest(URL, BODY, { 'x-base-url': BASE_URL, 'x-api-key': 'bad-key' }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'unauthorised', message: 'Incorrect API key' },
    });
  });

  it('handles network failure to the provider as 503 unavailable', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      jsonRequest(URL, BODY, { 'x-base-url': 'https://unreachable.host' }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'unavailable',
        message: expect.stringContaining('Could not reach the provider'),
      },
    });
  });
});
