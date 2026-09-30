import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '@/adapters/assistant/protocol';
import { BODY, jsonRequest, readAll } from './fixtures';

const cliAvailable = vi.fn<() => Promise<boolean>>();
const runClaudeCli = vi.fn();

vi.mock('@/adapters/assistant/server/claude-cli', () => ({ cliAvailable, runClaudeCli }));

const { GET, POST } = await import('@/app/api/assistant/local/route');
const { isLocalHost, isLocalRequest, localCliEnabled } =
  await import('@/adapters/assistant/server/local-guard');

function request(host: string, init: { origin?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { host };
  if (init.origin) headers.origin = init.origin;
  if (init.body !== undefined)
    return jsonRequest(`http://${host}/api/assistant/local`, init.body, headers);
  return new Request(`http://${host}/api/assistant/local`, { headers });
}

beforeEach(() => {
  cliAvailable.mockReset().mockResolvedValue(true);
  runClaudeCli.mockReset();
  vi.stubEnv('ASSISTANT_LOCAL_CLI', '');
  vi.stubEnv('NODE_ENV', 'development');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('local guard', () => {
  it('knows local hosts with and without ports', () => {
    for (const host of ['localhost', 'localhost:3000', '127.0.0.1:3000', '[::1]:3000', '::1']) {
      expect(isLocalHost(host)).toBe(true);
    }
    for (const host of ['example.com', 'localhost.example.com', '10.0.0.2:3000', '', null]) {
      expect(isLocalHost(host)).toBe(false);
    }
  });

  it('is enabled in development or with ASSISTANT_LOCAL_CLI=1 only', () => {
    expect(localCliEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(localCliEnabled({ NODE_ENV: 'production', ASSISTANT_LOCAL_CLI: '1' })).toBe(true);
    expect(localCliEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(localCliEnabled({ NODE_ENV: 'test', ASSISTANT_LOCAL_CLI: 'true' })).toBe(false);
  });

  it('refuses a local host with a foreign origin', () => {
    expect(isLocalRequest(request('localhost:3000', { origin: 'https://evil.example' }))).toBe(
      false,
    );
    expect(isLocalRequest(request('localhost:3000', { origin: 'http://localhost:3000' }))).toBe(
      true,
    );
  });
});

describe('GET /api/assistant/local', () => {
  it('reports availability on localhost in development', async () => {
    const response = await GET(request('localhost:3000'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: true });
  });

  it('reports a missing CLI as unavailable', async () => {
    cliAvailable.mockResolvedValue(false);
    expect(await (await GET(request('127.0.0.1:3000'))).json()).toEqual({ available: false });
  });

  it('is not there for a non-local host', async () => {
    expect((await GET(request('understory.example:443'))).status).toBe(404);
    expect(cliAvailable).not.toHaveBeenCalled();
  });

  it('is not there in production without the opt-in', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await GET(request('localhost:3000'))).status).toBe(404);
  });

  it('is there in production with ASSISTANT_LOCAL_CLI=1', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ASSISTANT_LOCAL_CLI', '1');
    expect((await GET(request('localhost:3000'))).status).toBe(200);
  });
});

describe('POST /api/assistant/local', () => {
  it('refuses non-local hosts and production before running anything', async () => {
    expect((await POST(request('understory.example', { body: BODY }))).status).toBe(404);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await POST(request('localhost:3000', { body: BODY }))).status).toBe(404);
    expect(runClaudeCli).not.toHaveBeenCalled();
  });

  it('streams the CLI reply as NDJSON', async () => {
    runClaudeCli.mockImplementation(async function* (): AsyncGenerator<StreamEvent> {
      yield { type: 'text', text: 'A streak ' };
      yield { type: 'text', text: 'of equal values.' };
      yield { type: 'done' };
    });
    const response = await POST(request('localhost:3000', { body: BODY }));
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(await readAll(response.body)).toEqual([
      { type: 'text', text: 'A streak ' },
      { type: 'text', text: 'of equal values.' },
      { type: 'done' },
    ]);
    expect(runClaudeCli.mock.calls[0]![0]).toMatchObject(BODY);
  });

  it('aborts the CLI when the response is cancelled', async () => {
    let signal: AbortSignal | undefined;
    runClaudeCli.mockImplementation(async function* (_body: unknown, s: AbortSignal) {
      signal = s;
      yield { type: 'text', text: 'first' };
      await new Promise(() => {});
    });
    const response = await POST(request('localhost:3000', { body: BODY }));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(signal?.aborted).toBe(true);
  });
});
