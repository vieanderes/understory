import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';
import { collect, CONTEXT } from './fixtures';

const { POST: mcpPost, GET: mcpGet, DELETE: mcpDelete } = await import('@/app/api/mcp/route');
const bridge = await import('@/app/api/assistant/bridge/route');
const { MCP_INSTRUCTIONS } = await import('@/adapters/assistant/server/mcp-server');
const { createMcpPort } = await import('@/adapters/assistant/mcp-port');

const ORIGIN = 'http://localhost:3000';

/** Routes fetches to the route handlers, as the Next server would. */
async function appFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(
    new URL(String(input instanceof Request ? input.url : input), ORIGIN),
    init,
  );
  const path = new URL(request.url).pathname;
  if (path === '/api/mcp') {
    if (request.method === 'POST') return mcpPost(request);
    if (request.method === 'GET') return mcpGet(request);
    return mcpDelete(request);
  }
  if (path === '/api/assistant/bridge') {
    return request.method === 'POST' ? bridge.POST(request) : bridge.GET(request);
  }
  return new Response('Not found', { status: 404 });
}

const clients: Client[] = [];

async function connect() {
  const client = new Client({ name: 'test-app', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('/api/mcp', ORIGIN), {
    fetch: appFetch,
  });
  await client.connect(transport);
  clients.push(client);
  return client;
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as { type: string; text: string }[];
  return content.map((part) => part.text).join('');
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe('MCP server at /api/mcp', () => {
  it('introduces itself with instructions and lists the five tools', async () => {
    const client = await connect();
    expect(client.getInstructions()).toBe(MCP_INSTRUCTIONS);
    expect(MCP_INSTRUCTIONS).toContain('get_pending_question');
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_code',
      'get_pending_question',
      'get_task',
      'get_test_output',
      'reply',
    ]);
    for (const tool of tools) expect(tool.inputSchema.required).toContain('code');
  });

  it('says so when the pairing code is unknown', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'get_task', arguments: { code: 'QQQQ-9999' } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No simulator is using that pairing code');
  });

  it('carries a question from the tab to the app and the reply back to the port', async () => {
    const code = 'MCPT2345';
    const port = createMcpPort({
      code,
      fetcher: appFetch as typeof fetch,
      pollMs: 5,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
    const replyChunks = collect(
      port.send({
        turns: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'Hello' },
          { role: 'user', text: 'Can the array be empty?' },
        ],
        context: { ...CONTEXT, output: 'FAIL: expected 3, got 0' },
      }),
    );

    const client = await connect();
    // The port posts the question first; wait until the bridge has it.
    let pending = '';
    for (let i = 0; i < 50 && !pending.includes('Pending question'); i += 1) {
      pending = textOf(
        await client.callTool({ name: 'get_pending_question', arguments: { code: 'mcpt-2345' } }),
      );
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    expect(pending).toContain('Can the array be empty?');
    expect(pending).toContain('Candidate: Hi');

    const task = textOf(await client.callTool({ name: 'get_task', arguments: { code } }));
    expect(task).toContain('Longest run');
    expect(task).toContain('javascript');
    expect(textOf(await client.callTool({ name: 'get_code', arguments: { code } }))).toBe(
      CONTEXT.code,
    );
    expect(
      textOf(await client.callTool({ name: 'get_test_output', arguments: { code } })),
    ).toContain('expected 3');

    const sent = await client.callTool({
      name: 'reply',
      arguments: { code, text: 'The statement allows N = 0, so return 0.' },
    });
    expect(sent.isError).toBeFalsy();
    expect(await replyChunks).toEqual(['The statement allows N = 0, so return 0.']);

    const after = textOf(
      await client.callTool({ name: 'get_pending_question', arguments: { code } }),
    );
    expect(after).toContain('No question is waiting');
  });
});

describe('bridge route', () => {
  it('rejects malformed codes and bodies', async () => {
    expect((await bridge.GET(new Request(`${ORIGIN}/api/assistant/bridge?code=nope`))).status).toBe(
      400,
    );
    expect(
      (await bridge.GET(new Request(`${ORIGIN}/api/assistant/bridge?code=ABCD2345&since=-1`)))
        .status,
    ).toBe(400);
    const bad = await bridge.POST(
      new Request(`${ORIGIN}/api/assistant/bridge`, {
        method: 'POST',
        body: JSON.stringify({ type: 'ask', code: 'ABCD2345', turns: [], context: CONTEXT }),
      }),
    );
    expect(bad.status).toBe(400);
  });

  it('stores pushed context', async () => {
    const response = await bridge.POST(
      new Request(`${ORIGIN}/api/assistant/bridge`, {
        method: 'POST',
        body: JSON.stringify({ type: 'context', code: 'CTXT2345', context: CONTEXT }),
      }),
    );
    expect(await response.json()).toEqual({ ok: true });
  });
});
