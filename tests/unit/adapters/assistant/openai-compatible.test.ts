import { describe, expect, it, vi } from 'vitest';
import { AssistantError } from '@/core/ports/assistant';
import {
  buildOpenAiChatRequest,
  createOpenAiCompatiblePort,
  DEFAULT_OPENAI_MODEL,
  isLocalUrl,
  readOpenAiStream,
  resolveCompletionsUrl,
} from '@/adapters/assistant/openai-compatible';
import { createAssistantPort } from '@/adapters/assistant';
import { BODY, collect, ndjson } from './fixtures';

const REQUEST = BODY;

function sseStreamOf(text: string, split = 5): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += split) {
        controller.enqueue(bytes.slice(i, i + split));
      }
      controller.close();
    },
  });
}

async function failure(promise: Promise<unknown>): Promise<AssistantError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AssistantError);
    return error as AssistantError;
  }
  throw new Error('Expected a failure');
}

describe('resolveCompletionsUrl', () => {
  it('appends /chat/completions when /v1 is present', () => {
    expect(resolveCompletionsUrl('http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1/chat/completions',
    );
    expect(resolveCompletionsUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
  });

  it('appends /v1/chat/completions when bare origin is provided', () => {
    expect(resolveCompletionsUrl('http://localhost:11434')).toBe(
      'http://localhost:11434/v1/chat/completions',
    );
  });

  it('preserves url already ending in /chat/completions', () => {
    expect(resolveCompletionsUrl('http://localhost:1234/v1/chat/completions/')).toBe(
      'http://localhost:1234/v1/chat/completions',
    );
  });
});

describe('isLocalUrl', () => {
  it('detects localhost, 127.0.0.1, and loopback addresses', () => {
    expect(isLocalUrl('http://localhost:11434')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1:11434/v1')).toBe(true);
    expect(isLocalUrl('http://[::1]:11434')).toBe(true);
  });

  it('returns false for remote hosts', () => {
    expect(isLocalUrl('https://api.openai.com/v1')).toBe(false);
    expect(isLocalUrl('https://api.groq.com/openai/v1')).toBe(false);
    expect(isLocalUrl('https://openrouter.ai/api/v1')).toBe(false);
  });
});

describe('buildOpenAiChatRequest (request shape)', () => {
  it('builds valid chat completions shape with system prompt and normalized turns', () => {
    const payload = buildOpenAiChatRequest(REQUEST, 'llama3.2');
    expect(payload.model).toBe('llama3.2');
    expect(payload.stream).toBe(true);
    expect(payload.messages[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Task: Longest run'),
    });
    expect(payload.messages.slice(1)).toEqual([
      { role: 'user', content: 'What does a run mean here?' },
    ]);
  });

  it('uses default model if none specified', () => {
    const payload = buildOpenAiChatRequest(REQUEST, '');
    expect(payload.model).toBe(DEFAULT_OPENAI_MODEL);
  });
});

describe('readOpenAiStream (streaming parser)', () => {
  it('parses delta content across chunk boundaries and ends on [DONE]', async () => {
    const rawSse = [
      'data: {"choices":[{"delta":{"content":"Hello "}}]}\n',
      '\n',
      ': ping\n',
      'data: {"choices":[{"delta":{"content":"world!"}}]}\n',
      '\n',
      'data: [DONE]\n',
    ].join('');

    const stream = sseStreamOf(rawSse);
    const result = await collect(readOpenAiStream(stream));
    expect(result).toEqual(['Hello ', 'world!']);
  });

  it('handles multi-byte utf-8 characters split across byte boundaries', async () => {
    const rawSse = [
      'data: {"choices":[{"delta":{"content":"Größe "}}]}\n',
      'data: {"choices":[{"delta":{"content":"ist 5"}}]}\n',
      'data: [DONE]\n',
    ].join('');

    const stream = sseStreamOf(rawSse, 2);
    const result = await collect(readOpenAiStream(stream));
    expect(result).toEqual(['Größe ', 'ist 5']);
  });

  it('throws an AssistantError if stream ends before [DONE]', async () => {
    const rawSse = 'data: {"choices":[{"delta":{"content":"partial"}}]}\n';
    const error = await failure(collect(readOpenAiStream(sseStreamOf(rawSse))));
    expect(error.code).toBe('failed');
    expect(error.message).toContain('broke off');
  });

  it('stops quietly when aborted mid-stream', async () => {
    const controller = new AbortController();
    controller.abort();
    const rawSse = 'data: {"choices":[{"delta":{"content":"abc"}}]}\n';
    const result = await collect(readOpenAiStream(sseStreamOf(rawSse), controller.signal));
    expect(result).toEqual(['abc']);
  });

  it('throws mapped error when error payload is received', async () => {
    const rawSse = 'data: {"error":{"message":"Model not found"}}\n';
    const error = await failure(collect(readOpenAiStream(sseStreamOf(rawSse))));
    expect(error.code).toBe('failed');
    expect(error.message).toBe('Model not found');
  });
});

describe('createOpenAiCompatiblePort', () => {
  it('requires a base URL', async () => {
    const port = createOpenAiCompatiblePort({
      getBaseUrl: () => '',
    });
    const error = await failure(collect(port.send(REQUEST)));
    expect(error.code).toBe('unavailable');
    expect(error.message).toContain('base URL');
  });

  it('calls localhost directly with optional key and yields stream', async () => {
    const rawSse = 'data: {"choices":[{"delta":{"content":"Direct reply"}}]}\n\ndata: [DONE]\n';
    const fetcher = vi.fn(async () => new Response(sseStreamOf(rawSse), { status: 200 }));

    const port = createOpenAiCompatiblePort({
      getBaseUrl: () => 'http://localhost:11434',
      getModel: () => 'llama3.2',
      getKey: () => 'ollama-key',
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(port.id).toBe('openai-compatible');
    const chunks = await collect(port.send(REQUEST));
    expect(chunks).toEqual(['Direct reply']);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer ollama-key');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('llama3.2');
    expect(body.stream).toBe(true);
  });

  it('calls localhost without Authorization header when key is omitted', async () => {
    const rawSse = 'data: {"choices":[{"delta":{"content":"Local"}}]}\n\ndata: [DONE]\n';
    const fetcher = vi.fn(async () => new Response(sseStreamOf(rawSse), { status: 200 }));

    const port = createOpenAiCompatiblePort({
      getBaseUrl: () => 'http://localhost:11434/v1',
      getModel: () => 'llama3.2',
      getKey: () => '',
      fetcher: fetcher as unknown as typeof fetch,
    });

    await collect(port.send(REQUEST));
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('routes remote base URLs through /api/assistant/compatible', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(ndjson([{ type: 'text', text: 'Proxied' }, { type: 'done' }]), {
          status: 200,
        }),
    );

    const port = createOpenAiCompatiblePort({
      getBaseUrl: () => 'https://api.openai.com/v1',
      getModel: () => 'gpt-4o-mini',
      getKey: () => 'sk-test',
      fetcher: fetcher as unknown as typeof fetch,
    });

    const chunks = await collect(port.send(REQUEST));
    expect(chunks).toEqual(['Proxied']);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/assistant/compatible');
    expect((init.headers as Record<string, string>)['x-base-url']).toBe(
      'https://api.openai.com/v1',
    );
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'gpt-4o-mini',
      turns: REQUEST.turns,
    });
  });

  it('maps HTTP errors from local server', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Unauthorized model access' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const port = createOpenAiCompatiblePort({
      getBaseUrl: () => 'http://localhost:11434',
      fetcher: fetcher as unknown as typeof fetch,
    });

    const error = await failure(collect(port.send(REQUEST)));
    expect(error.code).toBe('unauthorised');
    expect(error.message).toBe('Unauthorized model access');
  });

  it('is returned by createAssistantPort with id openai-compatible', () => {
    const port = createAssistantPort('openai-compatible', {
      getKey: () => '',
      pairing: { code: '', secret: '' },
      getOpenAiUrl: () => 'http://localhost:11434',
    });
    expect(port.id).toBe('openai-compatible');
  });
});
