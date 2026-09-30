import type { UrlParts } from './types';

const DEFAULT_PORT = { http: 80, https: 443 } as const;

/*
 * RFC 3986 section 3 splits a URI into scheme, authority, path, query and fragment. The
 * WHATWG URL Standard is what browsers follow, and adds the default ports. This parser
 * covers the http(s) subset the lab needs. It leaves out userinfo, IPv6 literals,
 * percent-encoding and IDNA, and returns null for anything it does not understand.
 */
const PATTERN =
  /^(https?):\/\/([a-z0-9.-]+)(?::(\d{1,5}))?(\/[^?#\s]*)?(?:\?([^#\s]*))?(?:#(\S*))?$/i;

export function parseUrl(input: string): UrlParts | null {
  const match = PATTERN.exec(input.trim());
  if (!match) return null;
  const scheme = match[1]!.toLowerCase() as UrlParts['scheme'];
  const host = match[2]!.toLowerCase();
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  const explicit = match[3] === undefined ? null : Number(match[3]);
  if (explicit !== null && (explicit < 1 || explicit > 65535)) return null;
  const port = explicit ?? DEFAULT_PORT[scheme];
  return {
    scheme,
    host,
    port,
    defaultPort: port === DEFAULT_PORT[scheme],
    path: match[4] ?? '/',
    query: match[5] ?? null,
    fragment: match[6] ?? null,
  };
}

/** The request target of RFC 9112 section 3.2.1 (origin-form): path plus query. */
export function requestTarget(url: UrlParts): string {
  return url.query === null ? url.path : `${url.path}?${url.query}`;
}
