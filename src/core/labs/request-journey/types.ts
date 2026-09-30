export type HttpVersion = '1.1' | '2' | '3';
export type CdnMode = 'hit' | 'miss' | 'none';
/** What the browser's HTTP cache holds for the URL before the journey starts. */
export type HttpCacheState = 'empty' | 'stale' | 'fresh';

export interface JourneyInput {
  url: string;
  /** Round-trip time between the browser and the origin server, in ms. */
  rttMs: number;
  dnsCached: boolean;
  connectionReused: boolean;
  /** A session ticket from an earlier visit lets the request ride as 0-RTT early data. */
  tlsResumed: boolean;
  http: HttpVersion;
  cdn: CdnMode;
  /** Time the origin spends producing the response, in ms. */
  serverMs: number;
  /** Size of the HTML on the wire, after Content-Encoding, in kB (1000 bytes). */
  htmlKb: number;
  bandwidthMbps: number;
  renderBlockingCss: boolean;
  /** Round-trip time between the browser and the CDN edge. Used when `cdn` is not 'none'. */
  edgeRttMs?: number;
  httpCache?: HttpCacheState;
  /** Round-trip time to the recursive resolver. Defaults to the RTT of the nearest server. */
  resolverRttMs?: number;
}

export type Party = 'browser' | 'resolver' | 'cdn' | 'server';

export type HopId =
  | 'url'
  | 'cache'
  | 'dns'
  | 'tcp'
  | 'tls'
  | 'quic'
  | 'request'
  | 'origin'
  | 'server'
  | 'transfer'
  | 'parse'
  | 'css'
  | 'render';

/** One arrow in the sequence diagram. `from === to` is something a party does by itself. */
export interface Message {
  from: Party;
  to: Party;
  label: string;
}

export interface Frame {
  hop: HopId | 'start';
  title: string;
  /** What this step did, in words. The view announces it. */
  status: string;
  messages: readonly Message[];
  /** Literal lines worth reading: URL parts, header lines. */
  lines: readonly string[];
  /** Time this step adds. A round trip is charged to the step where the reply arrives. */
  costMs: number;
  /** Time since Enter, after this step. */
  elapsedMs: number;
}

export interface HopCost {
  hop: HopId;
  label: string;
  ms: number;
  /** Why the hop cost nothing, when a cache or a toggle skipped it. */
  skipped: string | null;
}

export interface UrlParts {
  scheme: 'http' | 'https';
  host: string;
  port: number;
  /** True when the URL named no port and the scheme's default applies. */
  defaultPort: boolean;
  path: string;
  query: string | null;
  /** Never sent to the server: the browser keeps it to scroll after paint. */
  fragment: string | null;
}

export interface Journey {
  url: UrlParts;
  /** Columns of the sequence diagram, left to right. */
  parties: readonly Party[];
  frames: readonly Frame[];
  breakdown: readonly HopCost[];
  totalMs: number;
  /** Every hop that ties for the largest cost. Never empty: painting always costs. */
  dominant: readonly HopId[];
}
