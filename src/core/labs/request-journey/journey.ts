import type {
  Frame,
  HopCost,
  HopId,
  HttpCacheState,
  Journey,
  JourneyInput,
  Message,
  Party,
  UrlParts,
} from './types';
import { parseUrl, requestTarget } from './url';

/*
 * A first-order model of one page load: every hop costs a whole number of round trips
 * plus fixed work. Sources for the rules:
 *   RFC 1034 / RFC 1035  DNS: stub resolver, recursive resolver, referrals, TTL caching
 *   RFC 9293             TCP: the three-way handshake
 *   RFC 8446             TLS 1.3: 1-RTT handshake, 0-RTT early data with a pre-shared key
 *   RFC 9000 / RFC 9001  QUIC: transport and TLS 1.3 handshakes combined
 *   RFC 9110 / RFC 9111  HTTP semantics, conditional requests, caching
 *   RFC 9112 / 9113 / 9114  HTTP/1.1, HTTP/2 and HTTP/3 message framing
 *   HTML Standard, "Parsing HTML documents"; CSSOM, layout and paint per the browser's
 *   rendering pipeline (render-blocking stylesheets)
 *
 * What this leaves out, on purpose: TCP slow start and congestion control (a 60 kB body
 * really needs more than one flight on a fresh connection), packet loss and retransmission,
 * HTTP/2 multiplexing and prioritisation, OCSP and certificate fetching, Happy Eyeballs
 * (racing IPv6 and IPv4), service workers, and HTTP redirects.
 */

export const DEFAULT_URL = 'https://www.weather.example/forecast?city=leeds';
export const DEFAULT_EDGE_RTT_MS = 15;

/*
 * A cold recursive lookup walks root, TLD and authoritative servers (RFC 1034 section
 * 5.3.3). The resolver sits in a data centre, so each upstream query is given a nominal
 * 20 ms. In practice the root and TLD answers are nearly always cached at the resolver.
 */
export const DNS_UPSTREAM_QUERY_MS = 20;
export const DNS_UPSTREAM_QUERIES = 3;

/*
 * Nominal figures for a mid-range phone. They exist so the browser's share of the bar is
 * not zero. Real values depend on the page and the device.
 */
export const PARSE_MS_PER_KB = 0.5;
export const CSS_KB = 30;
export const STYLE_MS = 15;
export const LAYOUT_MS = 20;
export const PAINT_MS = 10;

const ORIGIN_IP = '198.51.100.7';
const EDGE_IP = '203.0.113.10';

export const HOP_LABEL: Readonly<Record<HopId, string>> = {
  url: 'URL parsing',
  cache: 'Cache checks',
  dns: 'DNS lookup',
  tcp: 'TCP handshake',
  tls: 'TLS 1.3 handshake',
  quic: 'QUIC handshake',
  request: 'Request round trip',
  origin: 'Edge to origin',
  server: 'Server time',
  transfer: 'Download',
  parse: 'HTML parsing',
  css: 'Render-blocking CSS',
  render: 'Style, layout, paint',
};

export const PARTY_LABEL: Readonly<Record<Party, string>> = {
  browser: 'Browser',
  resolver: 'Resolver',
  cdn: 'CDN',
  server: 'Server',
};

interface Normalised {
  url: UrlParts;
  rttMs: number;
  edgeRttMs: number;
  resolverRttMs: number;
  dnsCached: boolean;
  connectionReused: boolean;
  tlsResumed: boolean;
  http: JourneyInput['http'];
  cdn: JourneyInput['cdn'];
  httpCache: HttpCacheState;
  serverMs: number;
  htmlKb: number;
  bandwidthMbps: number;
  renderBlockingCss: boolean;
}

const wholeMs = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

/** kB on the wire over Mbps: kB x 8 = kbit, Mbps = kbit per ms. */
export function transferMs(kb: number, bandwidthMbps: number): number {
  return wholeMs((kb * 8) / bandwidthMbps);
}

function normalise(input: JourneyInput): Normalised {
  const url = parseUrl(input.url) ?? parseUrl(DEFAULT_URL)!;
  const rttMs = wholeMs(input.rttMs);
  const edgeRttMs = wholeMs(input.edgeRttMs ?? DEFAULT_EDGE_RTT_MS);
  const nearRtt = input.cdn === 'none' ? rttMs : edgeRttMs;
  return {
    url,
    rttMs,
    edgeRttMs,
    // First order: on a phone the radio link dominates every path, so the resolver is
    // taken to be as far away as the nearest server unless the caller says otherwise.
    resolverRttMs: wholeMs(input.resolverRttMs ?? nearRtt),
    dnsCached: input.dnsCached,
    connectionReused: input.connectionReused,
    tlsResumed: input.tlsResumed,
    // Browsers speak HTTP/2 and HTTP/3 over TLS only, so a plain http URL means HTTP/1.1.
    http: url.scheme === 'http' ? '1.1' : input.http,
    cdn: input.cdn,
    httpCache: input.httpCache ?? 'empty',
    serverMs: wholeMs(input.serverMs),
    htmlKb: Math.max(0, Number.isFinite(input.htmlKb) ? input.htmlKb : 0),
    bandwidthMbps: Number.isFinite(input.bandwidthMbps) ? Math.max(0.1, input.bandwidthMbps) : 0.1,
    renderBlockingCss: input.renderBlockingCss,
  };
}

/*
 * RFC 9112 sends a request line and a Host header. HTTP/2 (RFC 9113 section 8.3.1) and
 * HTTP/3 (RFC 9114 section 4.3.1) carry the same facts as pseudo-header fields, with
 * :authority in place of Host, and lower-case field names.
 */
function requestLines(
  n: Normalised,
  target: string,
  conditional: boolean,
  accept: string,
): string[] {
  const authority = n.url.defaultPort ? n.url.host : `${n.url.host}:${n.url.port}`;
  const fields: [string, string][] = [
    ['Accept', accept],
    ['Accept-Encoding', 'gzip, br'],
    ['Cookie', 'basket=7f3a9c'],
  ];
  // RFC 9110 section 13.1.2: If-None-Match makes the request conditional on the ETag.
  if (conditional) fields.push(['If-None-Match', '"forecast-v42"']);
  if (n.http === '1.1') {
    return [
      `GET ${target} HTTP/1.1`,
      `Host: ${authority}`,
      ...fields.map(([k, v]) => `${k}: ${v}`),
    ];
  }
  return [
    ':method: GET',
    `:scheme: ${n.url.scheme}`,
    `:authority: ${authority}`,
    `:path: ${target}`,
    ...fields.map(([k, v]) => `${k.toLowerCase()}: ${v}`),
  ];
}

function responseLines(n: Normalised, notModified: boolean): string[] {
  const fields: [string, string][] = [];
  if (!notModified) {
    fields.push(['Content-Type', 'text/html; charset=utf-8'], ['Content-Encoding', 'br']);
  }
  fields.push(['Cache-Control', 'public, max-age=60'], ['ETag', '"forecast-v42"']);
  // RFC 9111 section 5.1 (Age) and RFC 9211 (Cache-Status) say what the edge did.
  if (n.cdn === 'hit') fields.push(['Age', '42'], ['Cache-Status', 'ExampleEdge; hit']);
  if (n.cdn === 'miss') fields.push(['Cache-Status', 'ExampleEdge; fwd=miss; stored']);
  const status = notModified ? '304' : '200';
  if (n.http === '1.1') {
    return [
      `HTTP/1.1 ${status} ${notModified ? 'Not Modified' : 'OK'}`,
      ...fields.map(([k, v]) => `${k}: ${v}`),
    ];
  }
  return [`:status: ${status}`, ...fields.map(([k, v]) => `${k.toLowerCase()}: ${v}`)];
}

const ms = (value: number): string => `${value} ms`;

export function journey(input: JourneyInput): Journey {
  const n = normalise(input);
  const { url } = n;
  const target = requestTarget(url);
  const near: Party = n.cdn === 'none' ? 'server' : 'cdn';
  const nearName = n.cdn === 'none' ? 'the server' : 'the CDN edge';
  const nearRtt = n.cdn === 'none' ? n.rttMs : n.edgeRttMs;
  const secure = url.scheme === 'https';
  const quic = n.http === '3';
  const origin = `${url.host}:${url.port}`;

  const frames: Frame[] = [];
  const skipped = new Map<HopId, string>();
  let elapsedMs = 0;

  const step = (
    hop: Frame['hop'],
    title: string,
    status: string,
    detail: { messages?: Message[]; lines?: string[]; costMs?: number } = {},
  ): void => {
    const costMs = detail.costMs ?? 0;
    elapsedMs += costMs;
    frames.push({
      hop,
      title,
      status,
      messages: detail.messages ?? [],
      lines: detail.lines ?? [],
      costMs,
      elapsedMs,
    });
  };
  const note = (party: Party, label: string): Message => ({ from: party, to: party, label });
  const send = (from: Party, to: Party, label: string): Message => ({ from, to, label });

  step('start', 'Enter', `Enter pressed on ${renderUrl(url)}. Nothing has left the browser yet.`);

  // --- URL parsing (RFC 3986 section 3, WHATWG URL Standard) -------------------------
  step(
    'url',
    'Parse the URL',
    `The browser split the URL. It will speak ${url.scheme} to ${url.host} on port ${url.port}.`,
    {
      messages: [note('browser', 'Parse URL')],
      lines: [
        `scheme    ${url.scheme}`,
        `host      ${url.host}`,
        `port      ${url.port}${url.defaultPort ? ` (default for ${url.scheme})` : ''}`,
        `path      ${url.path}`,
        `query     ${url.query ?? '(none)'}`,
        ...(url.fragment === null ? [] : [`fragment  ${url.fragment} (stays in the browser)`]),
      ],
    },
  );

  // --- HTTP cache (RFC 9111 section 4) -----------------------------------------------
  const fresh = n.httpCache === 'fresh';
  const stale = n.httpCache === 'stale';
  if (fresh) {
    step(
      'cache',
      'Check the HTTP cache',
      'The HTTP cache holds a fresh copy. No network hop is needed at all.',
      {
        messages: [note('browser', 'HTTP cache: fresh copy')],
        lines: ['Cache-Control: public, max-age=60', 'Age of the stored copy: 12 s'],
      },
    );
    const reason = 'Served from the HTTP cache';
    for (const hop of [
      'dns',
      'tcp',
      'tls',
      'quic',
      'request',
      'origin',
      'server',
      'transfer',
    ] as const) {
      skipped.set(hop, reason);
    }
  } else {
    step(
      'cache',
      'Check the HTTP cache',
      stale
        ? 'The HTTP cache holds a stale copy with an ETag. The browser must ask whether it still holds.'
        : 'The HTTP cache holds nothing for this URL. The request must go out.',
      {
        messages: [
          note('browser', stale ? 'HTTP cache: stale copy, revalidate' : 'HTTP cache: miss'),
        ],
        lines: stale ? ['Stored: ETag "forecast-v42", max-age=60, age 300 s'] : [],
      },
    );

    // --- Connection pool --------------------------------------------------------------
    if (n.connectionReused) {
      step(
        'cache',
        'Check the connection pool',
        `An idle connection to ${origin} is open. DNS and both handshakes are skipped.`,
        { messages: [note('browser', 'Connection pool: reuse')] },
      );
      const reason = 'Connection reused';
      for (const hop of ['dns', 'tcp', 'tls', 'quic'] as const) skipped.set(hop, reason);
    } else {
      step(
        'cache',
        'Check the connection pool',
        `No open connection to ${origin}. The browser needs an address first.`,
        { messages: [note('browser', 'Connection pool: none')] },
      );
      resolve();
      connect();
    }
    exchange();
  }
  render();

  // --- DNS (RFC 1034 section 5, RFC 1035) ---------------------------------------------
  function resolve(): void {
    const ip = n.cdn === 'none' ? ORIGIN_IP : EDGE_IP;
    if (n.dnsCached) {
      step('dns', 'Check the DNS cache', `The DNS cache still holds ${url.host}. No lookup.`, {
        messages: [note('browser', `DNS cache: ${ip}`)],
      });
      skipped.set('dns', 'DNS cached');
      return;
    }
    step(
      'dns',
      'Check the DNS cache',
      `Neither the browser nor the operating system knows ${url.host}. The stub resolver must ask.`,
      { messages: [note('browser', 'DNS cache: miss')] },
    );
    step(
      'dns',
      'Ask the recursive resolver',
      'The stub resolver sent one query to the recursive resolver.',
      {
        messages: [send('browser', 'resolver', `A ${url.host}?`)],
      },
    );
    const tld = url.host.slice(url.host.lastIndexOf('.') + 1);
    const zone = url.host.split('.').slice(-2).join('.');
    const upstream: [string, string, string][] = [
      [
        'root',
        `Ask a root server: refer to .${tld}`,
        `A root server referred the resolver to the .${tld} servers.`,
      ],
      [
        'TLD',
        `Ask .${tld}: refer to ${zone}`,
        `The .${tld} servers referred the resolver to the name servers of ${zone}.`,
      ],
      [
        'authoritative',
        `Ask ${zone}: ${n.cdn === 'none' ? `A ${ip}` : `CNAME to the edge, A ${ip}`}`,
        `The authoritative server of ${zone} answered with ${ip}.`,
      ],
    ];
    for (const [who, label, status] of upstream) {
      step(
        'dns',
        `Resolver asks the ${who} server`,
        `${status} Resolvers usually have this cached.`,
        {
          messages: [note('resolver', label)],
          costMs: DNS_UPSTREAM_QUERY_MS,
        },
      );
    }
    step(
      'dns',
      'The answer returns',
      `The resolver answered ${ip}. Every cache on the way keeps it for the TTL.`,
      {
        messages: [send('resolver', 'browser', `A ${ip}, TTL 300`)],
        costMs: n.resolverRttMs,
      },
    );
  }

  // --- Transport and TLS --------------------------------------------------------------
  function connect(): void {
    if (quic) {
      skipped.set('tcp', 'HTTP/3 runs over QUIC');
      skipped.set('tls', 'Inside the QUIC handshake');
      if (n.tlsResumed) {
        skipped.set('quic', '0-RTT resumption');
        return;
      }
      // RFC 9000 section 7, RFC 9001 section 4: the TLS 1.3 messages travel inside QUIC
      // Initial and Handshake packets, so transport and encryption are ready after 1 RTT.
      step(
        'quic',
        'QUIC Initial',
        `The browser sent a QUIC Initial packet with the TLS ClientHello inside, over UDP to ${nearName}.`,
        {
          messages: [send('browser', near, 'Initial: ClientHello')],
        },
      );
      step(
        'quic',
        'QUIC handshake reply',
        `One round trip set up transport and encryption together: ${ms(nearRtt)}.`,
        {
          messages: [
            send(near, 'browser', 'Initial + Handshake: ServerHello, certificate, Finished'),
          ],
          costMs: nearRtt,
        },
      );
      step(
        'quic',
        'QUIC Finished',
        'The browser sent Finished. The request follows in the same flight, so this costs no waiting.',
        {
          messages: [send('browser', near, 'Handshake: Finished')],
        },
      );
      return;
    }
    skipped.set('quic', `HTTP/${n.http} runs over TCP`);

    // RFC 9293 section 3.5: SYN, SYN-ACK, ACK. Data may follow the ACK at once, so the
    // handshake costs one round trip, not one and a half.
    step('tcp', 'TCP SYN', `The browser sent SYN to ${nearName} on port ${url.port}.`, {
      messages: [send('browser', near, 'SYN')],
    });
    step('tcp', 'TCP SYN-ACK', `SYN-ACK came back after one round trip: ${ms(nearRtt)}.`, {
      messages: [send(near, 'browser', 'SYN-ACK')],
      costMs: nearRtt,
    });
    step(
      'tcp',
      'TCP ACK',
      'The browser sent ACK. The connection is open, and the next bytes leave without waiting.',
      {
        messages: [send('browser', near, 'ACK')],
      },
    );

    if (!secure) {
      skipped.set('tls', 'Plain http: nothing is encrypted');
      return;
    }
    if (n.tlsResumed) {
      skipped.set('tls', '0-RTT resumption');
      return;
    }
    // RFC 8446 section 2: the full TLS 1.3 handshake completes in one round trip.
    step(
      'tls',
      'TLS ClientHello',
      'The browser sent ClientHello with its key share and the server name.',
      {
        messages: [send('browser', near, 'ClientHello + key share')],
      },
    );
    step(
      'tls',
      'TLS server flight',
      `ServerHello, the certificate and Finished arrived after one round trip: ${ms(nearRtt)}.`,
      {
        messages: [send(near, 'browser', 'ServerHello, Certificate, CertificateVerify, Finished')],
        costMs: nearRtt,
      },
    );
    step(
      'tls',
      'TLS Finished',
      'The browser checked the certificate and sent Finished. The request follows in the same flight.',
      {
        messages: [send('browser', near, 'Finished')],
      },
    );
  }

  // --- HTTP request and response (RFC 9110) -------------------------------------------
  function exchange(): void {
    const request = requestLines(n, target, stale, 'text/html');
    const short = `GET ${target}`;
    const earlyData = n.tlsResumed && secure && !n.connectionReused;
    if (earlyData) {
      // RFC 8446 section 2.3: early data rides with the ClientHello under a pre-shared
      // key. It can be replayed, so browsers only send idempotent requests this way.
      step(
        'request',
        'Request as 0-RTT early data',
        `The browser sent ClientHello with a pre-shared key and the request as early data${quic ? ', in one QUIC flight' : ''}. No handshake round trip.`,
        {
          messages: [
            send(
              'browser',
              near,
              quic ? 'Initial: ClientHello + pre-shared key' : 'ClientHello + pre-shared key',
            ),
            send('browser', near, `${quic ? '0-RTT packet' : 'Early data'}: ${short}`),
          ],
          lines: request,
        },
      );
    } else {
      step(
        'request',
        'Send the request',
        `The browser sent ${short} to ${nearName}${stale ? ', conditional on the ETag' : ''}.`,
        {
          messages: [send('browser', near, stale ? `${short} (If-None-Match)` : short)],
          lines: request,
        },
      );
    }

    if (n.cdn === 'hit') {
      step(
        'server',
        'Edge cache lookup',
        'The edge holds a fresh copy. The origin never sees this request.',
        {
          messages: [note('cdn', 'Edge cache: hit')],
        },
      );
      skipped.set('server', 'CDN hit: the origin is not asked');
      skipped.set('origin', 'CDN hit: the origin is not asked');
    } else {
      if (n.cdn === 'miss') {
        step(
          'origin',
          'Edge cache lookup',
          'The edge has no copy. It forwards the request to the origin over a connection it keeps warm.',
          {
            messages: [note('cdn', 'Edge cache: miss'), send('cdn', 'server', short)],
          },
        );
      }
      step(
        'server',
        'The server works',
        `The origin spent ${ms(n.serverMs)} producing the response.`,
        {
          messages: [note('server', stale ? 'Compare ETag' : 'Render page')],
          costMs: n.serverMs,
        },
      );
      if (n.cdn === 'miss') {
        // First order: the edge is near the learner, so the edge is about as far from the
        // origin as the learner is.
        step(
          'origin',
          'Origin answers the edge',
          `The response crossed from the origin to the edge: one origin round trip, ${ms(n.rttMs)}. The edge stores it.`,
          {
            messages: [send('server', 'cdn', stale ? '304 Not Modified' : '200 OK')],
            costMs: n.rttMs,
          },
        );
      }
    }

    const response = responseLines(n, stale);
    const statusLine = stale ? '304 Not Modified' : '200 OK';
    step(
      'request',
      'The response starts',
      `${statusLine} arrived one round trip after the request left: ${ms(nearRtt)}.`,
      {
        messages: [
          ...(earlyData ? [send(near, 'browser', 'ServerHello, Finished')] : []),
          send(near, 'browser', statusLine),
        ],
        lines: response,
        costMs: nearRtt,
      },
    );

    if (stale) {
      // RFC 9110 section 15.4.5: a 304 has no content.
      step(
        'transfer',
        'No body to download',
        'A 304 carries no body. The browser reuses its cached copy and refreshes its age.',
        {
          messages: [note('browser', 'Reuse cached body')],
        },
      );
      skipped.set('transfer', '304: the cached body is reused');
    } else {
      const cost = transferMs(n.htmlKb, n.bandwidthMbps);
      step(
        'transfer',
        'Download the HTML',
        `${n.htmlKb} kB at ${n.bandwidthMbps} Mbps took ${ms(cost)}.`,
        {
          messages: [send(near, 'browser', `HTML body, ${n.htmlKb} kB`)],
          costMs: cost,
        },
      );
    }
  }

  // --- The browser's side: parse, CSS, layout, paint ----------------------------------
  function render(): void {
    const parseCost = wholeMs(n.htmlKb * PARSE_MS_PER_KB);
    step(
      'parse',
      'Parse the HTML',
      `The parser turned bytes into tokens and tokens into DOM nodes: ${ms(parseCost)}.`,
      {
        messages: [note('browser', 'Parse HTML, build DOM')],
        costMs: parseCost,
      },
    );
    step(
      'parse',
      'Discover subresources',
      'The preload scanner found a stylesheet, a deferred script and an image. Only the stylesheet blocks rendering.',
      {
        messages: [note('browser', 'Find style.css, app.js, poster.avif')],
        lines: [
          '<link rel="stylesheet" href="/assets/style.css">',
          '<script src="/assets/app.js" defer></script>',
          '<img src="/assets/poster.avif" loading="lazy">',
        ],
      },
    );

    if (!n.renderBlockingCss) {
      step(
        'css',
        'Critical CSS is inlined',
        'The styles for the first screen sit in the HTML. Nothing blocks rendering.',
        {
          messages: [note('browser', 'Inline <style>: no fetch')],
        },
      );
      skipped.set('css', 'Critical CSS inlined');
    } else if (n.httpCache !== 'empty') {
      step(
        'css',
        'Stylesheet from the HTTP cache',
        'style.css is fingerprinted and cached as immutable. It costs no round trip.',
        {
          messages: [note('browser', 'style.css: HTTP cache')],
        },
      );
      skipped.set('css', 'style.css is in the HTTP cache');
    } else {
      step(
        'css',
        'Request the stylesheet',
        'The browser will not paint without the CSSOM, so rendering waits for style.css.',
        {
          messages: [send('browser', near, 'GET /assets/style.css')],
          lines: requestLines(n, '/assets/style.css', false, 'text/css').slice(
            0,
            n.http === '1.1' ? 3 : 5,
          ),
        },
      );
      const cost = nearRtt + transferMs(CSS_KB, n.bandwidthMbps);
      step(
        'css',
        'The stylesheet arrives',
        `One more round trip on the open connection plus ${CSS_KB} kB: ${ms(cost)}.`,
        {
          messages: [send(near, 'browser', `200 OK, style.css ${CSS_KB} kB`)],
          costMs: cost,
        },
      );
    }

    step(
      'render',
      'Build the CSSOM and render tree',
      `DOM and CSSOM combined into the render tree: ${ms(STYLE_MS)}.`,
      {
        messages: [note('browser', 'DOM + CSSOM: render tree')],
        costMs: STYLE_MS,
      },
    );
    step(
      'render',
      'Layout',
      `The browser computed the size and position of every box: ${ms(LAYOUT_MS)}.`,
      {
        messages: [note('browser', 'Layout')],
        costMs: LAYOUT_MS,
      },
    );
    step('render', 'Paint', `First paint ${ms(elapsedMs + PAINT_MS)} after Enter.`, {
      messages: [note('browser', 'Paint')],
      costMs: PAINT_MS,
    });
  }

  // --- Cost breakdown -------------------------------------------------------------------
  const hops: HopId[] = ['url', 'cache', 'dns'];
  hops.push(...(quic ? (['quic'] as const) : (['tcp', 'tls'] as const)));
  // In the order the time is charged: the response round trip lands after the server's work.
  hops.push('server');
  if (n.cdn !== 'none') hops.push('origin');
  hops.push('request', 'transfer', 'parse', 'css', 'render');

  const breakdown: HopCost[] = hops.map((hop) => {
    const total = frames.reduce((sum, frame) => (frame.hop === hop ? sum + frame.costMs : sum), 0);
    return { hop, label: HOP_LABEL[hop], ms: total, skipped: skipped.get(hop) ?? null };
  });
  const max = Math.max(...breakdown.map((cost) => cost.ms));
  const parties: Party[] =
    n.cdn === 'none' ? ['browser', 'resolver', 'server'] : ['browser', 'resolver', 'cdn', 'server'];

  return {
    url,
    parties,
    frames,
    breakdown,
    totalMs: elapsedMs,
    dominant: breakdown.filter((cost) => cost.ms === max).map((cost) => cost.hop),
  };
}

function renderUrl(url: UrlParts): string {
  const port = url.defaultPort ? '' : `:${url.port}`;
  const fragment = url.fragment === null ? '' : `#${url.fragment}`;
  return `${url.scheme}://${url.host}${port}${requestTarget(url)}${fragment}`;
}
