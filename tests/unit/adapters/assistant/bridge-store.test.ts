import { describe, expect, it } from 'vitest';
import {
  backendFromEnv,
  BridgeStore,
  getBridgeStore,
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
    const { questionId, since } = await store.ask(CODE, turns, CONTEXT);
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
    expect((await store.repliesSince(CODE, 0)).replies).toEqual([reply]);
    expect((await store.repliesSince(CODE, 1)).replies).toEqual([]);
    expect((await store.repliesSince(CODE, 0)).agentSeenAt).not.toBeNull();
  });

  it('replaces a waiting question with a newer one and numbers replies after it', async () => {
    const store = make();
    await store.ask(CODE, [{ role: 'user', text: 'First' }], CONTEXT);
    await store.reply(CODE, 'One');
    const second = await store.ask(CODE, [{ role: 'user', text: 'Second' }], CONTEXT);
    const third = await store.ask(CODE, [{ role: 'user', text: 'Third' }], CONTEXT);
    expect(second.since).toBe(1);
    expect((await store.pending(CODE))?.id).toBe(third.questionId);
    expect((await store.reply(CODE, 'Two'))?.questionId).toBe(third.questionId);
  });

  it('refuses a reply for an unknown code', async () => {
    const store = make();
    expect(await store.reply(CODE, 'Anyone?')).toBeUndefined();
    expect(await store.repliesSince(CODE, 0)).toEqual({ replies: [], agentSeenAt: null });
    expect(await store.context(CODE)).toBeUndefined();
  });

  it('keeps context pushed between questions', async () => {
    const store = make();
    await store.putContext(CODE, CONTEXT);
    await store.putContext(CODE, { ...CONTEXT, code: 'changed' });
    expect((await store.context(CODE))?.code).toBe('changed');
    expect(await store.pending(CODE)).toBeUndefined();
  });

  it('keeps only the last fifty replies', async () => {
    const store = make();
    await store.putContext(CODE, CONTEXT);
    for (let i = 0; i < 60; i += 1) await store.reply(CODE, `r${i}`);
    const { replies } = await store.repliesSince(CODE, 0);
    expect(replies).toHaveLength(50);
    expect(replies[0]?.n).toBe(11);
  });
});

describe('BridgeStore backends', () => {
  it('forgets idle sessions after the TTL in memory, and keeps busy ones', async () => {
    const time = clock(1_000_000);
    const backend = new MemoryBackend(time.now);
    const store = new BridgeStore({ backend, ttlMs: 10 * 60_000, now: time.now });
    await store.putContext(CODE, CONTEXT);
    await store.putContext('ZZZZ2222', CONTEXT);
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
    await store.putContext(CODE, CONTEXT);
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
