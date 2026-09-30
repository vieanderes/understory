import { describe, expect, it } from 'vitest';
import { MemoryBackend } from '@/adapters/assistant/server/bridge-store';
import {
  allow,
  clientOf,
  FAILURES,
  limited,
  lockedOut,
  recordFailure,
} from '@/adapters/assistant/server/rate-limit';

const request = (ip: string) =>
  new Request('http://x/api/assistant', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

describe('assistant rate limit', () => {
  it('allows up to the limit in a window, then refuses until the next one', async () => {
    const kv = new MemoryBackend(() => 0);
    const rule = { limit: 2, windowMs: 1000 };
    expect(await allow(kv, 'k', rule, 0)).toBe(true);
    expect(await allow(kv, 'k', rule, 10)).toBe(true);
    expect(await allow(kv, 'k', rule, 20)).toBe(false);
    expect(await allow(kv, 'other', rule, 20)).toBe(true);
    expect(await allow(kv, 'k', rule, 1000)).toBe(true);
  });

  it('keys by the forwarded client and answers 429 in the assistant error shape', async () => {
    const kv = new MemoryBackend();
    expect(clientOf(request('1.2.3.4'))).toBe('1.2.3.4');
    expect(clientOf(new Request('http://x'))).toBe('local');
    for (let i = 0; i < 30; i++) expect(await limited(request('1.2.3.4'), 'reply', kv)).toBeNull();
    const refused = await limited(request('1.2.3.4'), 'reply', kv);
    expect(refused?.status).toBe(429);
    expect(await refused?.json()).toEqual({
      error: { code: 'rate-limited', message: expect.any(String) },
    });
    expect(await limited(request('5.6.7.8'), 'reply', kv)).toBeNull();
  });

  it('shuts out a client that keeps sending wrong codes, and only that client', async () => {
    const kv = new MemoryBackend();
    for (let i = 0; i < FAILURES.limit - 1; i++) await recordFailure(kv, '1.2.3.4');
    expect(await lockedOut(kv, '1.2.3.4')).toBe(false);
    expect(await limited(request('1.2.3.4'), 'mcp', kv)).toBeNull();
    await recordFailure(kv, '1.2.3.4');
    expect(await lockedOut(kv, '1.2.3.4')).toBe(true);
    const refused = await limited(request('1.2.3.4'), 'mcp', kv);
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get('retry-after')).toBe('600');
    expect(await limited(request('5.6.7.8'), 'mcp', kv)).toBeNull();
  });

  it('lets the lockout lapse after its window', async () => {
    let now = 0;
    const kv = new MemoryBackend(() => now);
    for (let i = 0; i < FAILURES.limit; i++) await recordFailure(kv, 'c');
    expect(await lockedOut(kv, 'c')).toBe(true);
    now += FAILURES.windowMs;
    expect(await lockedOut(kv, 'c')).toBe(false);
  });
});
