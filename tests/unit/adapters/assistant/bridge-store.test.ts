import { describe, expect, it } from 'vitest';
import {
  backendFromEnv,
  BridgeStore,
  DEFAULT_TTL_MS,
  getBridgeStore,
  hashSecret,
  MemoryBackend,
  RedisRestBackend,
} from '@/adapters/assistant/server/bridge-store';
import {
  createPairingCode,
  formatPairingCode,
  pairingCodeSchema,
} from '@/adapters/assistant/pairing';
import { CONTEXT } from './fixtures';

const CODE = 'ABCD2345';
const SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);

/** The value of a tab call that must succeed. */
function ok<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error('The tab was refused.');
  return result.value;
}

function clock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('pairing codes', () => {
  it('are eight unambiguous characters and survive retyping', () => {
    const code = createPairingCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(pairingCodeSchema.parse(formatPairingCode(code).toLowerCase())).toBe(code);
    expect(pairingCodeSchema.safeParse('ABCD-1234').success).toBe(false);
    expect(pairingCodeSchema.safeParse('short').success).toBe(false);
  });

  it('redraw bytes that would bias the alphabet', () => {
    const draws = [new Uint8Array([255, 0, 1, 2, 3, 4, 5, 6]), new Uint8Array([7])];
    const code = createPairingCode((bytes) => {
      bytes.set(draws.shift() ?? new Uint8Array(bytes.length));
      return bytes;
    });
    expect(code).toBe('HABCDEFG');
  });
});

/** A fake Upstash: the REST commands the backend sends, answered from a map. */
function fakeUpstash() {
  const data = new Map<string, string>();
  const commands: unknown[][] = [];
  const fetcher = (async (_url: string, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body)) as [string, string, string?, string?, number?];
    commands.push(args);
    if (args[0] === 'GET') return Response.json({ result: data.get(args[1]) ?? null });
    if (args[0] === 'SET') {
      data.set(args[1], args[2] ?? '');
      return Response.json({ result: 'OK' });
    }
    if (args[0] === 'DEL') {
      data.delete(args[1]);
      return Response.json({ result: 1 });
    }
    if (args[0] === 'INCR') {
      const next = Number(data.get(args[1]) ?? 0) + 1;
      data.set(args[1], String(next));
      return Response.json({ result: next });
    }
    if (args[0] === 'PEXPIRE') return Response.json({ result: 1 });
    return Response.json({ error: 'unknown command' });
  }) as typeof fetch;
  return { fetcher, commands, data };
}

const backends = {
  memory: () => new MemoryBackend(),
  redis: () => new RedisRestBackend('https://redis.example', 'token', fakeUpstash().fetcher),
};

describe.each(Object.entries(backends))('BridgeStore on %s', (_name, makeBackend) => {
  const make = () => new BridgeStore({ backend: makeBackend() });

  it('carries a question to the app and its reply back to the tab', async () => {
    const store = make();
    expect(await store.has(CODE)).toBe(false);
    const turns = [
      { role: 'user' as const, text: 'Hi' },
      { role: 'assistant' as const, text: 'Hello' },
      { role: 'user' as const, text: 'Is an empty array valid?' },
    ];
    const { questionId, since } = ok(await store.ask(CODE, SECRET, turns, CONTEXT));
    expect(since).toBe(0);
    expect(await store.context(CODE)).toEqual(CONTEXT);
    expect(await store.pending(CODE)).toMatchObject({
      id: questionId,
      text: 'Is an empty array valid?',
      earlier: turns.slice(0, 2),
    });

    const reply = await store.reply(CODE, 'Yes, return 0.');
    expect(reply).toMatchObject({ n: 1, questionId, text: 'Yes, return 0.' });
    expect(await store.pending(CODE)).toBeUndefined();
    expect(ok(await store.repliesSince(CODE, SECRET, 0)).replies).toEqual([reply]);
    expect(ok(await store.repliesSince(CODE, SECRET, 1)).replies).toEqual([]);
    expect(ok(await store.repliesSince(CODE, SECRET, 0)).agentSeenAt).not.toBeNull();
  });

  it('replaces a waiting question with a newer one and numbers replies after it', async () => {
    const store = make();
    ok(await store.ask(CODE, SECRET, [{ role: 'user', text: 'First' }], CONTEXT));
    await store.reply(CODE, 'One');
    const second = ok(await store.ask(CODE, SECRET, [{ role: 'user', text: 'Second' }], CONTEXT));
    const third = ok(await store.ask(CODE, SECRET, [{ role: 'user', text: 'Third' }], CONTEXT));
    expect(second.since).toBe(1);
    expect((await store.pending(CODE))?.id).toBe(third.questionId);
    expect((await store.reply(CODE, 'Two'))?.questionId).toBe(third.questionId);
  });

  it('refuses a reply for an unknown code', async () => {
    const store = make();
    expect(await store.reply(CODE, 'Anyone?')).toBeUndefined();
    expect(ok(await store.repliesSince(CODE, SECRET, 0))).toEqual({
      replies: [],
      agentSeenAt: null,
      connection: { allowed: null, request: null },
    });
    expect(await store.context(CODE)).toBeUndefined();
  });

  it('keeps context pushed between questions', async () => {
    const store = make();
    await store.putContext(CODE, SECRET, CONTEXT);
    await store.putContext(CODE, SECRET, { ...CONTEXT, code: 'changed' });
    expect((await store.context(CODE))?.code).toBe('changed');
    expect(await store.pending(CODE)).toBeUndefined();
  });

  it('keeps only the last fifty replies', async () => {
    const store = make();
    await store.putContext(CODE, SECRET, CONTEXT);
    for (let i = 0; i < 60; i += 1) await store.reply(CODE, `r${i}`);
    const { replies } = ok(await store.repliesSince(CODE, SECRET, 0));
    expect(replies).toHaveLength(50);
    expect(replies[0]?.n).toBe(11);
  });

  it('serves the tab side only with the secret that opened the session', async () => {
    const store = make();
    ok(await store.putContext(CODE, SECRET, CONTEXT));
    const turns = [{ role: 'user' as const, text: 'Planted' }];
    expect(await store.ask(CODE, OTHER_SECRET, turns, CONTEXT)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(await store.putContext(CODE, OTHER_SECRET, CONTEXT)).toMatchObject({ ok: false });
    expect(await store.repliesSince(CODE, OTHER_SECRET, 0)).toMatchObject({ ok: false });
    expect(await store.end(CODE, OTHER_SECRET)).toMatchObject({ ok: false });
    expect(await store.pending(CODE)).toBeUndefined();
    expect(await store.has(CODE)).toBe(true);
  });

  it('serves only the connection the learner allowed', async () => {
    const store = make();
    expect(await store.connect(CODE, 'app-1')).toBe('unknown-code');
    ok(await store.putContext(CODE, SECRET, CONTEXT));
    expect(await store.connect(CODE, 'app-1')).toBe('pending');
    const { connection } = ok(await store.repliesSince(CODE, SECRET, 0));
    expect(connection.request).toMatchObject({ id: 'app-1' });
    expect(ok(await store.decide(CODE, SECRET, 'app-1', true))).toBe(true);
    expect(await store.connect(CODE, 'app-1')).toBe('allowed');
    expect(await store.connectionState(CODE, 'app-1')).toBe('allowed');

    // Someone else with the code waits, and is refused when the learner says no.
    expect(await store.connect(CODE, 'stranger')).toBe('pending');
    expect(await store.connect(CODE, 'app-1')).toBe('allowed');
    expect(ok(await store.decide(CODE, SECRET, 'stranger', false))).toBe(true);
    expect(await store.connect(CODE, 'stranger')).toBe('denied');
    expect(await store.connectionState(CODE, 'stranger')).toBe('denied');
    expect(await store.connectionState(CODE, 'nobody')).toBe('denied');

    // Only the tab can allow, and only the request that is waiting.
    await store.connect(CODE, 'app-2');
    expect(await store.decide(CODE, OTHER_SECRET, 'app-2', true)).toMatchObject({ ok: false });
    expect(ok(await store.decide(CODE, SECRET, 'app-9', true))).toBe(false);
    expect(await store.connect(CODE, 'app-2')).toBe('pending');
  });

  it('ends a session at once when the tab asks', async () => {
    const store = make();
    ok(await store.putContext(CODE, SECRET, CONTEXT));
    ok(await store.end(CODE, SECRET));
    expect(await store.has(CODE)).toBe(false);
    expect(await store.connect(CODE, 'app-1')).toBe('unknown-code');
  });

  it('keeps a hash of the secret, never the secret', async () => {
    const backend = makeBackend();
    const store = new BridgeStore({ backend });
    ok(await store.putContext(CODE, SECRET, CONTEXT));
    const session = await backend.load(CODE);
    expect(session?.secretHash).toBe(await hashSecret(SECRET));
    expect(JSON.stringify(session)).not.toContain(SECRET);
  });

  it('counts in a window that expires', async () => {
    const backend = makeBackend();
    expect(await backend.increment('n', 1000)).toBe(1);
    expect(await backend.increment('n', 1000)).toBe(2);
    expect(await backend.get('n')).toBe('2');
    await backend.set('k', 'v', 1000);
    expect(await backend.get('k')).toBe('v');
    await backend.delete('k');
    expect(await backend.get('k')).toBeUndefined();
  });
});

describe('BridgeStore backends', () => {
  it('forgets idle sessions after the TTL in memory, and keeps busy ones', async () => {
    const time = clock(1_000_000);
    const backend = new MemoryBackend(time.now);
    const store = new BridgeStore({ backend, ttlMs: 10 * 60_000, now: time.now });
    await store.putContext(CODE, SECRET, CONTEXT);
    await store.putContext('ZZZZ2222', SECRET, CONTEXT);
    time.advance(6 * 60_000);
    await store.context(CODE);
    time.advance(6 * 60_000);
    backend.sweep();
    expect(backend.size).toBe(1);
    expect(await store.has(CODE)).toBe(true);
    time.advance(11 * 60_000);
    expect(await store.has(CODE)).toBe(false);
  });

  it('sends Redis one SET with an expiry, and a GET per read', async () => {
    const upstash = fakeUpstash();
    const store = new BridgeStore({
      backend: new RedisRestBackend('https://r', 't', upstash.fetcher),
      ttlMs: 5000,
    });
    await store.putContext(CODE, SECRET, CONTEXT);
    expect(upstash.commands).toEqual([
      ['GET', `understory:bridge:${CODE}`],
      ['SET', `understory:bridge:${CODE}`, expect.any(String), 'PX', 5000],
    ]);
    const failing = new RedisRestBackend(
      'https://r',
      't',
      (async () => new Response('', { status: 500 })) as typeof fetch,
    );
    await expect(failing.load(CODE)).rejects.toThrow('500');
    const refusing = new RedisRestBackend('https://r', 't', (async () =>
      Response.json({ error: 'WRONGPASS' })) as typeof fetch);
    await expect(refusing.load(CODE)).rejects.toThrow('WRONGPASS');
    const garbled = new RedisRestBackend('https://r', 't', (async () =>
      Response.json({ result: '{nope' })) as typeof fetch);
    expect(await garbled.load(CODE)).toBeUndefined();
  });

  it('forgets an idle session after thirty minutes by default', () => {
    expect(DEFAULT_TTL_MS).toBe(30 * 60_000);
  });

  it('gives a counter its expiry once, when the window opens', async () => {
    const upstash = fakeUpstash();
    const backend = new RedisRestBackend('https://r', 't', upstash.fetcher);
    await backend.increment('rate:x', 60_000);
    await backend.increment('rate:x', 60_000);
    expect(upstash.commands).toEqual([
      ['INCR', 'understory:rate:x'],
      ['PEXPIRE', 'understory:rate:x', 60_000],
      ['INCR', 'understory:rate:x'],
    ]);
  });

  it('picks Redis when its variables are set, memory otherwise', () => {
    expect(backendFromEnv({})).toBeInstanceOf(MemoryBackend);
    expect(
      backendFromEnv({ UPSTASH_REDIS_REST_URL: 'https://r', UPSTASH_REDIS_REST_TOKEN: 't' }),
    ).toBeInstanceOf(RedisRestBackend);
    expect(backendFromEnv({ KV_REST_API_URL: 'https://r', KV_REST_API_TOKEN: 't' })).toBeInstanceOf(
      RedisRestBackend,
    );
  });

  it('is one store per process, kept on globalThis across module reloads', () => {
    expect(getBridgeStore()).toBe(getBridgeStore());
  });
});
