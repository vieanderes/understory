import { describe, expect, it } from 'vitest';
import {
  CSS_KB,
  DEFAULT_EDGE_RTT_MS,
  DNS_UPSTREAM_QUERIES,
  DNS_UPSTREAM_QUERY_MS,
  LAYOUT_MS,
  PAINT_MS,
  PARSE_MS_PER_KB,
  STYLE_MS,
  journey,
  transferMs,
  type HopId,
  type Journey,
  type JourneyInput,
} from '@/core/labs/request-journey';
import { intBelow, mulberry32 } from '@/core/util';

const COLD: JourneyInput = {
  url: 'https://www.weather.example/forecast?city=leeds',
  rttMs: 80,
  dnsCached: false,
  connectionReused: false,
  tlsResumed: false,
  http: '2',
  cdn: 'none',
  serverMs: 120,
  htmlKb: 60,
  bandwidthMbps: 20,
  renderBlockingCss: true,
};

const cost = (run: Journey, hop: HopId): number | undefined =>
  run.breakdown.find((entry) => entry.hop === hop)?.ms;
const skipped = (run: Journey, hop: HopId): string | null | undefined =>
  run.breakdown.find((entry) => entry.hop === hop)?.skipped;
const labels = (run: Journey): string[] =>
  run.frames.flatMap((frame) => frame.messages.map((m) => m.label));
const lines = (run: Journey): string[] => run.frames.flatMap((frame) => [...frame.lines]);

const BROWSER_MS = Math.round(60 * PARSE_MS_PER_KB) + STYLE_MS + LAYOUT_MS + PAINT_MS;
const COLD_DNS = 80 + DNS_UPSTREAM_QUERIES * DNS_UPSTREAM_QUERY_MS;
const CSS_MS = 80 + transferMs(CSS_KB, 20);

describe('transferMs', () => {
  it('is kB times 8 over Mbps, in whole ms', () => {
    expect(transferMs(60, 20)).toBe(24);
    expect(transferMs(1000, 8)).toBe(1000);
    expect(transferMs(0, 20)).toBe(0);
    expect(transferMs(10, 3)).toBe(27);
  });
});

describe('a cold HTTPS fetch over TCP and TLS 1.3', () => {
  const run = journey(COLD);

  it('costs DNS + 1 RTT (TCP) + 1 RTT (TLS) + 1 RTT (request) + server + transfer', () => {
    expect(cost(run, 'dns')).toBe(COLD_DNS);
    expect(cost(run, 'tcp')).toBe(80);
    expect(cost(run, 'tls')).toBe(80);
    expect(cost(run, 'request')).toBe(80);
    expect(cost(run, 'server')).toBe(120);
    expect(cost(run, 'transfer')).toBe(24);
    expect(cost(run, 'quic')).toBeUndefined();
    expect(cost(run, 'origin')).toBeUndefined();
  });

  it('adds the browser side: parse, one round trip for blocking CSS, style, layout, paint', () => {
    expect(cost(run, 'parse')).toBe(30);
    expect(cost(run, 'css')).toBe(CSS_MS);
    expect(cost(run, 'render')).toBe(STYLE_MS + LAYOUT_MS + PAINT_MS);
    expect(run.totalMs).toBe(COLD_DNS + 80 * 3 + 120 + 24 + CSS_MS + BROWSER_MS);
  });

  it('charges nothing for parsing the URL or checking caches', () => {
    expect(cost(run, 'url')).toBe(0);
    expect(cost(run, 'cache')).toBe(0);
  });

  it('names DNS as the dominant hop', () => {
    expect(run.dominant).toEqual(['dns']);
  });

  it('walks the hops in order', () => {
    const order = run.frames.map((frame) => frame.hop).filter((hop, i, all) => hop !== all[i - 1]);
    expect(order).toEqual([
      'start',
      'url',
      'cache',
      'dns',
      'tcp',
      'tls',
      'request',
      'server',
      'request',
      'transfer',
      'parse',
      'css',
      'render',
    ]);
  });

  it('shows the three-way handshake and the TLS flights as messages', () => {
    const all = labels(run);
    const syn = all.indexOf('SYN');
    expect(all.slice(syn, syn + 3)).toEqual(['SYN', 'SYN-ACK', 'ACK']);
    expect(all).toContain('ClientHello + key share');
    expect(all).toContain('ServerHello, Certificate, CertificateVerify, Finished');
  });

  it('resolves through root, TLD and authoritative servers', () => {
    const all = labels(run);
    expect(all).toContain('A www.weather.example?');
    expect(all).toContain('Ask a root server: refer to .example');
    expect(all).toContain('Ask .example: refer to weather.example');
    expect(all).toContain('Ask weather.example: A 198.51.100.7');
    expect(all).toContain('A 198.51.100.7, TTL 300');
  });

  it('uses three parties when there is no CDN', () => {
    expect(run.parties).toEqual(['browser', 'resolver', 'server']);
  });

  it('shows the URL parts', () => {
    const url = run.frames.find((frame) => frame.hop === 'url')!;
    expect(url.lines).toEqual([
      'scheme    https',
      'host      www.weather.example',
      'port      443 (default for https)',
      'path      /forecast',
      'query     city=leeds',
    ]);
  });

  it('shows real HTTP/2 header lines', () => {
    const all = lines(run);
    expect(all).toEqual(
      expect.arrayContaining([
        ':method: GET',
        ':authority: www.weather.example',
        ':path: /forecast?city=leeds',
        'accept: text/html',
        'cookie: basket=7f3a9c',
      ]),
    );
    expect(all).toEqual(
      expect.arrayContaining([
        ':status: 200',
        'content-type: text/html; charset=utf-8',
        'cache-control: public, max-age=60',
        'content-encoding: br',
      ]),
    );
  });
});

describe('each toggle', () => {
  it('dnsCached removes the lookup', () => {
    const run = journey({ ...COLD, dnsCached: true });
    expect(cost(run, 'dns')).toBe(0);
    expect(skipped(run, 'dns')).toBe('DNS cached');
    expect(run.totalMs).toBe(journey(COLD).totalMs - COLD_DNS);
    expect(labels(run)).not.toContain('A www.weather.example?');
  });

  it('resolverRttMs overrides the distance to the resolver', () => {
    expect(cost(journey({ ...COLD, resolverRttMs: 10 }), 'dns')).toBe(10 + 60);
  });

  it('a reused connection skips DNS and both handshakes', () => {
    const run = journey({ ...COLD, connectionReused: true });
    expect(cost(run, 'dns')).toBe(0);
    expect(cost(run, 'tcp')).toBe(0);
    expect(cost(run, 'tls')).toBe(0);
    expect(skipped(run, 'tcp')).toBe('Connection reused');
    expect(cost(run, 'request')).toBe(80);
    expect(run.totalMs).toBe(journey(COLD).totalMs - COLD_DNS - 160);
    expect(labels(run)).not.toContain('SYN');
  });

  it('a reused connection ignores TLS resumption: there is no handshake to shorten', () => {
    const reused = journey({ ...COLD, connectionReused: true });
    const both = journey({ ...COLD, connectionReused: true, tlsResumed: true });
    expect(both.totalMs).toBe(reused.totalMs);
    expect(labels(both).join(' ')).not.toMatch(/Early data|pre-shared/);
  });

  it('TLS 1.3 0-RTT resumption over TCP keeps the TCP round trip and drops the TLS one', () => {
    const run = journey({ ...COLD, tlsResumed: true });
    expect(cost(run, 'tcp')).toBe(80);
    expect(cost(run, 'tls')).toBe(0);
    expect(skipped(run, 'tls')).toBe('0-RTT resumption');
    expect(run.totalMs).toBe(journey(COLD).totalMs - 80);
    expect(labels(run)).toContain('Early data: GET /forecast?city=leeds');
    expect(labels(run)).toContain('ServerHello, Finished');
  });

  it('HTTP/3 combines transport and TLS into one round trip', () => {
    const run = journey({ ...COLD, http: '3' });
    expect(cost(run, 'quic')).toBe(80);
    expect(cost(run, 'tcp')).toBeUndefined();
    expect(cost(run, 'tls')).toBeUndefined();
    expect(run.totalMs).toBe(journey(COLD).totalMs - 80);
    expect(labels(run)).toContain('Initial: ClientHello');
    expect(labels(run)).not.toContain('SYN');
  });

  it('HTTP/3 with resumption needs no handshake round trip at all', () => {
    const run = journey({ ...COLD, http: '3', tlsResumed: true });
    expect(cost(run, 'quic')).toBe(0);
    expect(skipped(run, 'quic')).toBe('0-RTT resumption');
    expect(run.totalMs).toBe(journey(COLD).totalMs - 160);
    expect(labels(run)).toContain('0-RTT packet: GET /forecast?city=leeds');
  });

  it('HTTP/1.1 costs the same as HTTP/2 for one document but shows a request line and Host', () => {
    const run = journey({ ...COLD, http: '1.1' });
    expect(run.totalMs).toBe(journey(COLD).totalMs);
    expect(lines(run)).toEqual(
      expect.arrayContaining([
        'GET /forecast?city=leeds HTTP/1.1',
        'Host: www.weather.example',
        'Accept: text/html',
        'Cookie: basket=7f3a9c',
        'HTTP/1.1 200 OK',
        'Content-Type: text/html; charset=utf-8',
      ]),
    );
  });

  it('a CDN hit replaces the origin RTT with the edge RTT and removes server time', () => {
    const run = journey({ ...COLD, cdn: 'hit', edgeRttMs: 15 });
    expect(cost(run, 'dns')).toBe(15 + 60);
    expect(cost(run, 'tcp')).toBe(15);
    expect(cost(run, 'tls')).toBe(15);
    expect(cost(run, 'request')).toBe(15);
    expect(cost(run, 'server')).toBe(0);
    expect(cost(run, 'origin')).toBe(0);
    expect(skipped(run, 'server')).toMatch(/CDN hit/);
    expect(cost(run, 'css')).toBe(15 + transferMs(CSS_KB, 20));
    expect(run.parties).toEqual(['browser', 'resolver', 'cdn', 'server']);
    expect(
      run.frames.every((f) => f.messages.every((m) => m.from !== 'server' && m.to !== 'server')),
    ).toBe(true);
    expect(lines(run)).toEqual(
      expect.arrayContaining(['age: 42', 'cache-status: ExampleEdge; hit']),
    );
    expect(labels(run)).toContain('Ask weather.example: CNAME to the edge, A 203.0.113.10');
  });

  it('the edge RTT has a default', () => {
    expect(cost(journey({ ...COLD, cdn: 'hit' }), 'tcp')).toBe(DEFAULT_EDGE_RTT_MS);
  });

  it('a CDN miss adds one origin round trip and keeps server time', () => {
    const run = journey({ ...COLD, cdn: 'miss', edgeRttMs: 15 });
    expect(cost(run, 'request')).toBe(15);
    expect(cost(run, 'origin')).toBe(80);
    expect(cost(run, 'server')).toBe(120);
    expect(run.totalMs).toBe(journey({ ...COLD, cdn: 'hit', edgeRttMs: 15 }).totalMs + 80 + 120);
    expect(lines(run)).toContain('cache-status: ExampleEdge; fwd=miss; stored');
  });

  it('server time is added as given', () => {
    const run = journey({ ...COLD, serverMs: 1800 });
    expect(run.totalMs).toBe(journey(COLD).totalMs + 1680);
    expect(run.dominant).toEqual(['server']);
  });

  it('transfer time follows size and bandwidth', () => {
    expect(cost(journey({ ...COLD, htmlKb: 500, bandwidthMbps: 4 }), 'transfer')).toBe(1000);
    expect(cost(journey({ ...COLD, htmlKb: 500, bandwidthMbps: 4 }), 'parse')).toBe(250);
  });

  it('inlined CSS removes the render-blocking fetch', () => {
    const run = journey({ ...COLD, renderBlockingCss: false });
    expect(cost(run, 'css')).toBe(0);
    expect(skipped(run, 'css')).toBe('Critical CSS inlined');
    expect(run.totalMs).toBe(journey(COLD).totalMs - CSS_MS);
  });

  it('a stale HTTP cache entry revalidates: If-None-Match out, 304 back, no body', () => {
    const run = journey({ ...COLD, httpCache: 'stale' });
    expect(lines(run)).toEqual(
      expect.arrayContaining(['if-none-match: "forecast-v42"', ':status: 304']),
    );
    expect(lines(run)).not.toContain('content-type: text/html; charset=utf-8');
    expect(cost(run, 'transfer')).toBe(0);
    expect(skipped(run, 'transfer')).toMatch(/304/);
    expect(cost(run, 'request')).toBe(80);
    expect(cost(run, 'server')).toBe(120);
    expect(cost(run, 'css')).toBe(0);
    expect(run.totalMs).toBe(journey(COLD).totalMs - 24 - CSS_MS);
  });

  it('a 304 over HTTP/1.1 and through a CDN miss reads correctly', () => {
    const run = journey({ ...COLD, http: '1.1', cdn: 'miss', httpCache: 'stale' });
    expect(lines(run)).toContain('HTTP/1.1 304 Not Modified');
    expect(labels(run).filter((label) => label === '304 Not Modified')).toHaveLength(2);
  });

  it('a fresh HTTP cache entry skips the network entirely', () => {
    const run = journey({ ...COLD, httpCache: 'fresh' });
    expect(run.totalMs).toBe(BROWSER_MS);
    for (const hop of ['dns', 'tcp', 'tls', 'request', 'server', 'transfer'] as const) {
      expect(cost(run, hop)).toBe(0);
      expect(skipped(run, hop)).toBe('Served from the HTTP cache');
    }
    expect(
      run.frames.every((f) => f.messages.every((m) => m.from === 'browser' && m.to === 'browser')),
    ).toBe(true);
  });

  it('plain http has no TLS hop to pay for and falls back to HTTP/1.1', () => {
    const run = journey({
      ...COLD,
      url: 'http://www.weather.example/forecast',
      http: '3',
      tlsResumed: true,
    });
    expect(cost(run, 'tcp')).toBe(80);
    expect(cost(run, 'tls')).toBe(0);
    expect(skipped(run, 'tls')).toMatch(/Plain http/);
    expect(lines(run)).toContain('GET /forecast HTTP/1.1');
    expect(lines(run)).toContain('port      80 (default for http)');
  });

  it('shows an explicit port in Host and a fragment that stays in the browser', () => {
    const run = journey({
      ...COLD,
      http: '1.1',
      url: 'https://www.weather.example:8443/forecast#hourly',
    });
    expect(lines(run)).toContain('Host: www.weather.example:8443');
    expect(lines(run)).toContain('port      8443');
    expect(lines(run)).toContain('query     (none)');
    expect(lines(run)).toContain('fragment  hourly (stays in the browser)');
    expect(run.frames[0]!.status).toContain('https://www.weather.example:8443/forecast#hourly');
  });

  it('falls back to the default URL and to safe numbers on bad input', () => {
    const run = journey({
      ...COLD,
      url: 'not a url',
      rttMs: -5,
      serverMs: Number.NaN,
      htmlKb: Number.NaN,
      bandwidthMbps: 0,
    });
    expect(run.url.host).toBe('www.weather.example');
    expect(cost(run, 'tcp')).toBe(0);
    expect(cost(run, 'server')).toBe(0);
    expect(cost(run, 'transfer')).toBe(0);
    expect(journey({ ...COLD, bandwidthMbps: Number.NaN }).totalMs).toBeGreaterThan(0);
  });

  it('always has a dominant hop, because painting is never free', () => {
    const run = journey({ ...COLD, rttMs: 0, serverMs: 0, htmlKb: 0, httpCache: 'fresh' });
    expect(run.dominant).toEqual(['render']);
    expect(
      journey({ ...COLD, rttMs: 0, resolverRttMs: 0, dnsCached: true, serverMs: 0 }).dominant,
    ).not.toContain('tcp');
  });

  it('reports every hop that ties for the largest cost', () => {
    const run = journey({ ...COLD, dnsCached: true, serverMs: 80, renderBlockingCss: false });
    expect(run.dominant).toEqual(['tcp', 'tls', 'server', 'request']);
  });
});

describe('invariants, over seeded random inputs', () => {
  const rng = mulberry32(20260917);
  const pick = <T>(items: readonly T[]): T => items[intBelow(rng, items.length)]!;
  const bool = (): boolean => rng.next() < 0.5;
  const inputs: JourneyInput[] = Array.from({ length: 300 }, () => ({
    url: pick([
      'https://www.weather.example/forecast?city=leeds',
      'http://weather.example/',
      'https://weather.example:8443/basket#pay',
    ]),
    rttMs: intBelow(rng, 400),
    edgeRttMs: intBelow(rng, 60),
    dnsCached: bool(),
    connectionReused: bool(),
    tlsResumed: bool(),
    http: pick(['1.1', '2', '3'] as const),
    cdn: pick(['hit', 'miss', 'none'] as const),
    httpCache: pick(['empty', 'stale', 'fresh'] as const),
    serverMs: intBelow(rng, 3000),
    htmlKb: intBelow(rng, 800),
    bandwidthMbps: 1 + intBelow(rng, 100),
    renderBlockingCss: bool(),
  }));

  it('frame costs, the breakdown and the total always agree', () => {
    for (const input of inputs) {
      const run = journey(input);
      const fromFrames = run.frames.reduce((sum, frame) => sum + frame.costMs, 0);
      const fromBreakdown = run.breakdown.reduce((sum, entry) => sum + entry.ms, 0);
      expect(fromFrames).toBe(run.totalMs);
      expect(fromBreakdown).toBe(run.totalMs);
      expect(run.frames.at(-1)!.elapsedMs).toBe(run.totalMs);
    }
  });

  it('time never runs backwards, and every cost is a whole number of ms', () => {
    for (const input of inputs) {
      let previous = 0;
      for (const frame of journey(input).frames) {
        expect(Number.isInteger(frame.costMs)).toBe(true);
        expect(frame.costMs).toBeGreaterThanOrEqual(0);
        expect(frame.elapsedMs).toBe(previous + frame.costMs);
        previous = frame.elapsedMs;
      }
    }
  });

  it('starts at Enter, ends at paint, and says something at every step', () => {
    for (const input of inputs) {
      const run = journey(input);
      expect(run.frames[0]!.hop).toBe('start');
      expect(run.frames.at(-1)!.title).toBe('Paint');
      expect(run.frames.every((frame) => frame.status.length > 0 && frame.title.length > 0)).toBe(
        true,
      );
    }
  });

  it('only parties in the diagram exchange messages, and a skipped hop costs nothing', () => {
    for (const input of inputs) {
      const run = journey(input);
      for (const frame of run.frames) {
        for (const message of frame.messages) {
          expect(run.parties).toContain(message.from);
          expect(run.parties).toContain(message.to);
        }
      }
      for (const entry of run.breakdown) if (entry.skipped !== null) expect(entry.ms).toBe(0);
    }
  });

  it('warming a cache never makes the page slower', () => {
    for (const input of inputs) {
      const base = journey(input).totalMs;
      expect(journey({ ...input, dnsCached: true }).totalMs).toBeLessThanOrEqual(base);
      expect(journey({ ...input, connectionReused: true }).totalMs).toBeLessThanOrEqual(base);
      expect(journey({ ...input, tlsResumed: true }).totalMs).toBeLessThanOrEqual(base);
      expect(journey({ ...input, httpCache: 'fresh' }).totalMs).toBeLessThanOrEqual(base);
    }
  });

  it('is deterministic', () => {
    for (const input of inputs.slice(0, 20)) expect(journey(input)).toEqual(journey(input));
  });
});
