import { describe, expect, it, vi } from 'vitest';
import { AssistantError } from '@/core/ports/assistant';
import {
  createApiKeyPort,
  createAssistantPort,
  createLocalCliPort,
  createMcpPort,
  localCliAvailable,
} from '@/adapters/assistant';
import { ndjsonStream, normaliseTurns, type StreamEvent } from '@/adapters/assistant/protocol';
import { readNdjson } from '@/adapters/assistant/stream';
import { BODY, collect, ndjson } from './fixtures';

const REQUEST = BODY;

function streamOf(text: string, split = 3): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += split) controller.enqueue(bytes.slice(i, i + split));
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

describe('readNdjson', () => {
  it('yields text across chunk boundaries, multi-byte characters included', async () => {
    const body = streamOf(
      '{"type":"text","text":"Größe "}\n\n{"type":"text","text":"ist 3"}\n{"type":"done"}\n',
    );
    expect(await collect(readNdjson(body))).toEqual(['Größe ', 'ist 3']);
  });

  it('accepts a last line without a newline', async () => {
    expect(
      await collect(readNdjson(streamOf('{"type":"text","text":"a"}\n{"type":"done"}'))),
    ).toEqual(['a']);
  });

  it('throws the error event as an AssistantError', async () => {
    const error = await failure(
      collect(
        readNdjson(
          ndjson([
            { type: 'text', text: 'Half' },
            { type: 'error', code: 'rate-limited', message: 'Slow down.' },
          ]),
        ),
      ),
    );
    expect(error.code).toBe('rate-limited');
    expect(error.message).toBe('Slow down.');
  });

  it('treats a stream without done as broken off', async () => {
    const error = await failure(collect(readNdjson(ndjson([{ type: 'text', text: 'Half' }]))));
    expect(error.message).toContain('broke off');
  });

  it('ends quietly when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      await collect(readNdjson(ndjson([{ type: 'text', text: 'a' }]), controller.signal)),
    ).toEqual(['a']);
  });
});

describe('ndjsonStream and normaliseTurns', () => {
  it('writes each event as a line and reports a thrown source as an error line', async () => {
    async function* source(): AsyncGenerator<StreamEvent> {
      yield { type: 'text', text: 'x' };
      throw new Error('boom');
    }
    const text = await new Response(ndjsonStream(source())).text();
    expect(
      text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    ).toEqual([
      { type: 'text', text: 'x' },
      { type: 'error', code: 'failed', message: 'The reply broke off.' },
    ]);
  });

  it('joins runs of one role and drops a leading reply', () => {
    expect(
      normaliseTurns([
        { role: 'assistant', text: 'Welcome' },
        { role: 'user', text: 'a' },
        { role: 'user', text: 'b' },
        { role: 'assistant', text: 'c' },
      ]),
    ).toEqual([
      { role: 'user', text: 'a\n\nb' },
      { role: 'assistant', text: 'c' },
    ]);
  });
});

describe('api-key port', () => {
  it('sends the key in a header and yields the stream', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(ndjson([{ type: 'text', text: 'Hi' }, { type: 'done' }]), { status: 200 }),
    );
    const port = createApiKeyPort({
      getKey: () => ' sk-1 ',
      model: () => 'claude-opus-5-5',
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(port.id).toBe('api-key');
    expect(await collect(port.send(REQUEST))).toEqual(['Hi']);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/assistant');
    expect((init.headers as Record<string, string>)['x-anthropic-key']).toBe('sk-1');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'claude-opus-5-5',
      turns: BODY.turns,
    });
  });

  it('asks for a key before sending anything', async () => {
    const fetcher = vi.fn();
    const port = createApiKeyPort({
      getKey: () => '',
      fetcher: fetcher as unknown as typeof fetch,
    });
    const error = await failure(collect(port.send(REQUEST)));
    expect(error.code).toBe('unauthorised');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses the server words for an HTTP error', async () => {
    const fetcher = async () =>
      Response.json(
        { error: { code: 'unauthorised', message: 'Anthropic refused this API key.' } },
        { status: 401 },
      );
    const port = createApiKeyPort({
      getKey: () => 'k',
      fetcher: fetcher as unknown as typeof fetch,
    });
    const error = await failure(collect(port.send(REQUEST)));
    expect(error).toMatchObject({
      code: 'unauthorised',
      message: 'Anthropic refused this API key.',
    });
  });

  it('falls back to the status when the error is not JSON', async () => {
    const fetcher = async () => new Response('<html>Bad gateway</html>', { status: 429 });
    const port = createApiKeyPort({
      getKey: () => 'k',
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect((await failure(collect(port.send(REQUEST)))).code).toBe('rate-limited');
  });

  it('reports a network failure as unavailable, and an abort as nothing', async () => {
    const offline = createApiKeyPort({
      getKey: () => 'k',
      fetcher: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
    expect((await failure(collect(offline.send(REQUEST)))).code).toBe('unavailable');

    const aborted = createApiKeyPort({
      getKey: () => 'k',
      fetcher: (async () => {
        throw new DOMException('Aborted', 'AbortError');
      }) as unknown as typeof fetch,
    });
    expect(await collect(aborted.send(REQUEST))).toEqual([]);
  });
});

describe('local CLI port', () => {
  it('posts to the local route', async () => {
    const fetcher = vi.fn(
      async () => new Response(ndjson([{ type: 'text', text: 'ok' }, { type: 'done' }])),
    );
    const port = createLocalCliPort({ fetcher: fetcher as unknown as typeof fetch });
    expect(await collect(port.send(REQUEST))).toEqual(['ok']);
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe('/api/assistant/local');
  });

  it('explains a 404 away from localhost', async () => {
    const port = createLocalCliPort({
      fetcher: (async () => new Response('Not found', { status: 404 })) as unknown as typeof fetch,
    });
    const error = await failure(collect(port.send(REQUEST)));
    expect(error.code).toBe('unavailable');
    expect(error.message).toContain('runs on your machine');
  });

  it('reads availability from the GET route', async () => {
    expect(
      await localCliAvailable((async () =>
        Response.json({ available: true })) as unknown as typeof fetch),
    ).toBe(true);
    expect(
      await localCliAvailable(
        (async () => new Response('', { status: 404 })) as unknown as typeof fetch,
      ),
    ).toBe(false);
    expect(
      await localCliAvailable((async () => {
        throw new TypeError('offline');
      }) as unknown as typeof fetch),
    ).toBe(false);
  });
});

describe('mcp port', () => {
  it('gives up after the timeout with a plain message', async () => {
    let now = 0;
    const fetcher = async (url: string) =>
      url.startsWith('/api/assistant/bridge?')
        ? Response.json({ replies: [], agentSeenAt: null })
        : Response.json({ questionId: 1, since: 0 });
    const port = createMcpPort({
      code: 'ABCD2345',
      fetcher: fetcher as unknown as typeof fetch,
      timeoutMs: 3000,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });
    const error = await failure(collect(port.send(REQUEST)));
    expect(error.code).toBe('unavailable');
    expect(error.message).toContain('No reply from your Claude app');
  });

  it('stops polling when aborted', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (url: string) =>
      url.startsWith('/api/assistant/bridge?')
        ? Response.json({ replies: [], agentSeenAt: null })
        : Response.json({ questionId: 1, since: 0 }),
    );
    const port = createMcpPort({
      code: 'ABCD2345',
      fetcher: fetcher as unknown as typeof fetch,
      sleep: async () => controller.abort(),
    });
    expect(await collect(port.send(REQUEST, controller.signal))).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('createAssistantPort', () => {
  it('makes the adapter for each provider', () => {
    const settings = { getKey: () => '', pairingCode: 'ABCD2345' };
    expect(createAssistantPort('api-key', settings).id).toBe('api-key');
    expect(createAssistantPort('claude-cli', settings).id).toBe('claude-cli');
    expect(createAssistantPort('mcp', settings).id).toBe('mcp');
  });
});
