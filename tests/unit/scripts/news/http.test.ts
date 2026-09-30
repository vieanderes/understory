import { describe, expect, it } from 'vitest';
import {
  HttpError,
  mapWithConcurrency,
  politeFetch,
  USER_AGENT,
  MAX_RESPONSE_BYTES,
} from '../../../../scripts/news/http';
import { fakeFetch, fakeSleep, ok, status } from './helpers';

const URL_A = 'https://feeds.example/a.xml';

describe('politeFetch', () => {
  it('names the project in the User-Agent and sets a timeout', async () => {
    const net = fakeFetch([{ match: () => true, respond: () => ok('body') }]);
    expect(await politeFetch({ ...net, ...fakeSleep() }, URL_A)).toBe('body');
    const init = net.calls[0]?.init;
    expect(USER_AGENT).toMatch(/^UnderstorySignal\/\d/);
    expect((init?.headers as Record<string, string>)['user-agent']).toBe(USER_AGENT);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries once after a pause when the server is busy', async () => {
    let attempts = 0;
    const net = fakeFetch([
      { match: () => true, respond: () => ((attempts += 1) === 1 ? status(503) : ok('second')) },
    ]);
    const clock = fakeSleep();
    expect(await politeFetch({ ...net, ...clock }, URL_A, { backoffMs: 3_000 })).toBe('second');
    expect(net.calls).toHaveLength(2);
    expect(clock.pauses).toEqual([3_000]);
  });

  it('retries once after a network error', async () => {
    let attempts = 0;
    const net = fakeFetch([
      {
        match: () => true,
        respond: () => {
          attempts += 1;
          if (attempts === 1) throw new TypeError('fetch failed');
          return ok('recovered');
        },
      },
    ]);
    expect(await politeFetch({ ...net, ...fakeSleep() }, URL_A)).toBe('recovered');
  });

  it('gives up after the second failure', async () => {
    const net = fakeFetch([{ match: () => true, respond: () => status(500) }]);
    await expect(politeFetch({ ...net, ...fakeSleep() }, URL_A)).rejects.toBeInstanceOf(HttpError);
    expect(net.calls).toHaveLength(2);
  });

  it('does not retry an answer that will not change', async () => {
    const net = fakeFetch([{ match: () => true, respond: () => status(404) }]);
    const clock = fakeSleep();
    await expect(politeFetch({ ...net, ...clock }, URL_A)).rejects.toThrow('HTTP 404');
    expect(net.calls).toHaveLength(1);
    expect(clock.pauses).toEqual([]);
  });

  it('retries when asked to slow down', async () => {
    const net = fakeFetch([{ match: () => true, respond: () => status(429) }]);
    await expect(politeFetch({ ...net, ...fakeSleep() }, URL_A)).rejects.toThrow('HTTP 429');
    expect(net.calls).toHaveLength(2);
  });

  it('refuses a response that is far too large to be a feed', async () => {
    const net = fakeFetch([
      { match: () => true, respond: () => ok('x'.repeat(MAX_RESPONSE_BYTES + 1)) },
    ]);
    await expect(politeFetch({ ...net, ...fakeSleep() }, URL_A)).rejects.toThrow(/larger than/);
  });

  it('passes method, body and extra headers through', async () => {
    const net = fakeFetch([{ match: () => true, respond: () => ok('{}') }]);
    await politeFetch({ ...net, ...fakeSleep() }, URL_A, {
      init: { method: 'POST', body: '{"a":1}', headers: { 'x-api-key': 'k' } },
    });
    const init = net.calls[0]?.init;
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('k');
  });
});

describe('mapWithConcurrency', () => {
  it('keeps the input order and never exceeds the limit', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithConcurrency([5, 1, 4, 2, 3, 6, 7], 3, async (value) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, value));
      running -= 1;
      return value * 2;
    });
    expect(results).toEqual([10, 2, 8, 4, 6, 12, 14]);
    expect(peak).toBe(3);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 3, async (value: number) => value)).toEqual([]);
  });
});
