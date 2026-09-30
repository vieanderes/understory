/*
 * One story, one URL. The canonical form is the identity of an item: it feeds the id
 * hash and the first pass of dedupe. It is never fetched, so it may differ from the link
 * the reader follows (which stays in `url`).
 *
 * src/core has no `URL` class (no DOM and no Node types), so the URL is taken apart with
 * a regular expression. Only absolute http(s) URLs are accepted.
 */

const URL_PARTS = /^(https?):\/\/([^/?#\s]+)([^?#\s]*)(?:\?([^#\s]*))?(?:#\S*)?$/i;

/** Parameters that track a click and never select content. */
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'ref',
  'ref_src',
  'ref_url',
  'referrer',
  'source',
  'src',
  'cmpid',
  'campaign',
  's_cid',
  'share',
  'si',
  'spm',
  'trk',
  'yclid',
  '_hsenc',
  '_hsmi',
  'hsctatracking',
  'vero_id',
  'oly_anon_id',
  'oly_enc_id',
]);

const TRACKING_PREFIXES: readonly string[] = ['utm_', 'pk_', 'piwik_', 'ga_'];

const DEFAULT_PORT = /:(80|443)$/;

/** New style `2609.16338`, old style `cs/0703001`. A version suffix and `.pdf` may follow. */
const ARXIV_PATH =
  /^\/(?:abs|pdf|html)\/((?:\d{4}\.\d{4,5})|(?:[a-z-]+(?:\.[a-z]{2})?\/\d{7}))(?:v\d+)?(?:\.pdf)?\/?$/i;

const ARXIV_HOSTS: ReadonlySet<string> = new Set(['arxiv.org', 'export.arxiv.org']);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return TRACKING_PARAMS.has(lower) || TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function cleanQuery(query: string | undefined): string {
  if (query === undefined || query.length === 0) return '';
  const kept = query
    .split('&')
    .filter((pair) => pair.length > 0 && !isTrackingParam(pair.split('=')[0] ?? ''))
    // Sorted, so `?a=1&b=2` and `?b=2&a=1` are the same page.
    .sort();
  return kept.length > 0 ? `?${kept.join('&')}` : '';
}

/** Host without `www.`, without credentials and without a default port, lower-cased. */
export function hostOf(url: string): string | null {
  const match = URL_PARTS.exec(url.trim());
  const authority = match?.[2];
  if (authority === undefined) return null;
  const withoutCredentials = authority.slice(authority.lastIndexOf('@') + 1);
  return withoutCredentials
    .toLowerCase()
    .replace(DEFAULT_PORT, '')
    .replace(/^www\./, '');
}

export function canonicalise(url: string): string | null {
  const trimmed = url.trim();
  const match = URL_PARTS.exec(trimmed);
  const host = hostOf(trimmed);
  if (match === null || host === null || host.length === 0) return null;

  const path = match[3] ?? '';
  if (ARXIV_HOSTS.has(host)) {
    const paper = ARXIV_PATH.exec(path)?.[1];
    if (paper !== undefined) return `https://arxiv.org/abs/${paper.toLowerCase()}`;
  }

  // http and https serve the same article everywhere that matters; one scheme, one identity.
  return `https://${host}${path.replace(/\/+$/, '')}${cleanQuery(match[4])}`;
}
