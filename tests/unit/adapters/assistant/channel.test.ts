import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { Pairing } from '@/adapters/assistant/pairing';
import {
  classify,
  createChannel,
  INSTRUCTIONS,
  pairingCode,
  questionForSession,
  siteOrigin,
  type JsonRpcMessage,
} from '../../../../integrations/claude-code/channel.mjs';
import { collect, CONTEXT } from './fixtures';

const bridge = await import('@/app/api/assistant/bridge/route');
const { handleMcpRequest } = await import('@/adapters/assistant/server/mcp-server');
const { createMcpPort, decideMcpConnection, fetchMcpStatus } =
  await import('@/adapters/assistant/mcp-port');

/*
 * The Claude Code channel (integrations/claude-code/channel.mjs) against the real MCP
 * server and bridge, routed in process: a question asked in the tab arrives in the session
 * as a channel event, and the reply tool sends the answer back to the tab.
 */

const SITE = 'http://localhost:3000';
let clientN = 0;

async function appFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('x-forwarded-for', `10.8.${Math.floor(clientN / 250) % 250}.${clientN++ % 250}`);
  const request = new Request(new URL(String(input), SITE), { ...init, headers });
  const path = new URL(request.url).pathname;
  if (path === '/api/mcp') {
    return handleMcpRequest(request, {
      approvalWaitMs: 2000,
      pollMs: 5,
      listenMs: 100,
      listenPollMs: 5,
    });
  }
  if (path === '/api/assistant/bridge') {
    return request.method === 'POST' ? bridge.POST(request) : bridge.GET(request);
  }
  return new Response('Not found', { status: 404 });
}
const fetcher = appFetch as typeof fetch;

let secretN = 0;
const pairing = (code: string): Pairing => ({
  code,
  secret: (1000 + secretN++).toString(16).padStart(64, '0'),
});

async function tab(pair: Pairing, body: unknown) {
  return appFetch('/api/assistant/bridge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pairing-code': pair.code,
      'x-tab-secret': pair.secret,
    },
    body: JSON.stringify(body),
  });
}

async function allow(pair: Pairing) {
  for (let i = 0; i < 400; i += 1) {
    const status = await fetchMcpStatus(pair, fetcher);
    if (status?.request) return decideMcpConnection(pair, status.request.id, true, fetcher);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('The channel never asked to join.');
}

async function until<T>(find: () => T | undefined): Promise<T> {
  for (let i = 0; i < 400; i += 1) {
    const found = find();
    if (found !== undefined) return found;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out.');
}

const pushed = (sent: JsonRpcMessage[], kind: string) =>
  sent.find(
    (message) =>
      message.method === 'notifications/claude/channel' &&
      (message.params?.meta as { kind?: string } | undefined)?.kind === kind,
  );

describe('Claude Code channel', () => {
  it('declares itself a two-way channel with three tools', async () => {
    const sent: JsonRpcMessage[] = [];
    const channel = createChannel({ send: (message) => sent.push(message), fetch: fetcher });
    await channel.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await channel.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    await channel.handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const [init, list] = sent as unknown as [
      { result: { capabilities: Record<string, unknown>; instructions: string } },
      { result: { tools: { name: string }[] } },
    ];
    expect(init.result.capabilities).toEqual({
      experimental: { 'claude/channel': {} },
      tools: {},
    });
    expect(init.result.instructions).toBe(INSTRUCTIONS);
    expect(INSTRUCTIONS).toContain('<untrusted>');
    expect(list.result.tools.map((tool) => tool.name)).toEqual(['connect', 'reply', 'disconnect']);
    expect(sent).toHaveLength(2);
  });

  it('carries a question into the session once allowed, and the answer back to the tab', async () => {
    const pair = pairing('CHAN2345');
    await tab(pair, { type: 'context', context: CONTEXT });
    const sent: JsonRpcMessage[] = [];
    const channel = createChannel({
      send: (message) => sent.push(message),
      fetch: fetcher,
      retryMs: 5,
    });
    const connected = await channel.onTool('connect', { site: SITE, code: 'chan-2345' });
    expect(connected.isError).toBeFalsy();
    await allow(pair);

    const port = createMcpPort({
      pairing: pair,
      fetcher,
      pollMs: 5,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
    const answer = collect(
      port.send({ turns: [{ role: 'user', text: 'What is a run?' }], context: CONTEXT }),
    );
    const question = await until(() => pushed(sent, 'question'));
    const content = String(question.params?.content);
    expect(content).toContain('What is a run?');
    expect(content).toContain(CONTEXT.code);
    expect(content).toContain('Answer it with the reply tool of this channel.');
    expect(content).not.toContain('wait_for_question');

    const replied = await channel.onTool('reply', { text: 'Equal values side by side.' });
    expect(replied.isError).toBeFalsy();
    expect(await answer).toEqual(['Equal values side by side.']);

    await tab(pair, { type: 'end' });
    const closed = await until(() => pushed(sent, 'status'));
    // Closed mid-wait, or gone by the next check: either way the session hears it once.
    expect(String(closed.params?.content)).toMatch(/Stop listening|No simulator is using/);
    await until(() => (channel.connected ? undefined : true));
  });

  it('refuses a site that is not https, or a code that cannot be one', async () => {
    const channel = createChannel({ send: () => {}, fetch: fetcher });
    expect(
      (await channel.onTool('connect', { site: 'http://example.com', code: 'ABCD2345' })).isError,
    ).toBe(true);
    expect((await channel.onTool('connect', { site: SITE, code: 'nope' })).isError).toBe(true);
    expect((await channel.onTool('reply', { text: 'hi' })).isError).toBe(true);
    expect(channel.connected).toBe(false);
  });

  it('reads addresses, codes and results the way the loop needs', () => {
    expect(siteOrigin('https://understory.example/paths')).toBe('https://understory.example');
    expect(siteOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(siteOrigin('http://understory.example')).toBeNull();
    expect(siteOrigin('javascript:alert(1)')).toBeNull();
    expect(pairingCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(pairingCode('ABCD-EFGI')).toBeNull();
    expect(classify({ text: 'No new question yet. Call again.', isError: false })).toBe('idle');
    expect(classify({ text: 'The tab has closed. Stop listening.', isError: false })).toBe(
      'closed',
    );
    expect(classify({ text: 'has not allowed this connection yet', isError: true })).toBe(
      'waiting-for-allow',
    );
    expect(classify({ text: 'refused this connection', isError: true })).toBe('refused');
    expect(classify({ text: 'The question: hi', isError: false })).toBe('question');
    expect(
      questionForSession(
        'x\nAnswer it with the reply tool, then call wait_for_question again to keep listening.',
      ),
    ).toBe('x\nAnswer it with the reply tool of this channel.');
  });

  it('runs as a process: one JSON message per line over stdio', async () => {
    const child = spawn(process.execPath, ['integrations/claude-code/channel.mjs'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`,
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
    await until(() => (out.split('\n').filter(Boolean).length >= 2 ? true : undefined));
    child.stdin.end();
    const [init, list] = out
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { id: number; result: Record<string, unknown> });
    expect(init?.id).toBe(1);
    expect(list?.id).toBe(2);
    expect((init?.result.serverInfo as { name: string }).name).toBe('understory');
  });
});
