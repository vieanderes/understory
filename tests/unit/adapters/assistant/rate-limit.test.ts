import { beforeEach, describe, expect, it } from 'vitest';
import { allow, clientOf, limited, resetRateLimits } from '@/adapters/assistant/server/rate-limit';

describe('assistant rate limit', () => {
  beforeEach(() => resetRateLimits());

  it('allows up to the limit in a window, then refuses until the next one', () => {
    const rule = { limit: 2, windowMs: 1000 };
    expect(allow('k', rule, 0)).toBe(true);
    expect(allow('k', rule, 10)).toBe(true);
    expect(allow('k', rule, 20)).toBe(false);
    expect(allow('other', rule, 20)).toBe(true);
    expect(allow('k', rule, 1000)).toBe(true);
  });

  it('keys by the forwarded client and answers 429 in the assistant error shape', async () => {
    const request = (ip: string) =>
      new Request('http://x/api/assistant', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });
    expect(clientOf(request('1.2.3.4'))).toBe('1.2.3.4');
    expect(clientOf(new Request('http://x'))).toBe('local');
    for (let i = 0; i < 30; i++) expect(limited(request('1.2.3.4'), 'reply')).toBeNull();
    const refused = limited(request('1.2.3.4'), 'reply');
    expect(refused?.status).toBe(429);
    expect(await refused?.json()).toEqual({
      error: { code: 'rate-limited', message: expect.any(String) },
    });
    expect(limited(request('5.6.7.8'), 'reply')).toBeNull();
  });
});
