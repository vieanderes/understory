/*
 * Small text helpers shared by the news rules. They are pure string functions, so the
 * same behaviour can be mirrored in the Swift port without a text library.
 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '-',
  mdash: '-',
  hellip: '...',
};

/** Words carry no signal for "are these two headlines the same story". */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

/** Prefixes an aggregator adds to a title that the original post does not carry. */
const TITLE_PREFIX = /^(show hn|ask hn|tell hn|launch hn)\s*:\s*/i;

/** Suffixes such as "(2022)" or "[pdf]" that an aggregator appends. */
const TITLE_SUFFIX = /\s*(\((19|20)\d{2}\)|\[(pdf|video)\])\s*$/i;

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Feeds deliver descriptions as HTML, sometimes escaped twice. The excerpt is shown as
 * plain text, so tags are dropped and entities decoded before anything is stored.
 */
export function stripHtml(input: string): string {
  const withoutBlocks = input.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const decodedOnce = decodeEntities(withoutBlocks.replace(/<[^>]+>/g, ' '));
  // A second pass catches markup that was entity-escaped inside the XML.
  const plain = collapseWhitespace(decodeEntities(decodedOnce.replace(/<[^>]+>/g, ' ')));
  // Replacing a closing tag with a space leaves "word ." behind. Close that gap again.
  return plain.replace(/\s+([.,;:!?])(?=\s|$)/g, '$1');
}

export function words(input: string): string[] {
  return input.split(/\s+/).filter((word) => word.length > 0);
}

export function wordCount(input: string): number {
  return words(input).length;
}

/** Cuts at a word boundary and marks the cut, never exceeding `max` characters. */
export function truncateChars(input: string, max: number): string {
  if (input.length <= max) return input;
  const ellipsis = '...';
  const head = input.slice(0, max - ellipsis.length);
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace > max / 2 ? head.slice(0, lastSpace) : head;
  return `${cut.replace(/[\s,;:.-]+$/, '')}${ellipsis}`;
}

export function truncateWords(input: string, max: number): string {
  const all = words(input);
  if (all.length <= max) return all.join(' ');
  return `${all
    .slice(0, max)
    .join(' ')
    .replace(/[\s,;:.-]+$/, '')}...`;
}

/**
 * Splits after `.`, `?` or `!` when a capital, digit or quote follows. A single letter
 * before the full stop ("e.g.", "v.s.", "U.S.") marks an abbreviation, not an ending.
 */
const SENTENCE_BREAK = /(?<=[.?!])(?<!(?:^|[\s.(])[A-Za-z]\.)\s+(?=[A-Z0-9"'“])/;

export function splitSentences(input: string): string[] {
  return collapseWhitespace(input)
    .split(SENTENCE_BREAK)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** The bare headline, without aggregator decoration. */
export function cleanTitle(title: string): string {
  return collapseWhitespace(title).replace(TITLE_PREFIX, '').replace(TITLE_SUFFIX, '');
}

/** Lower-case alphanumeric tokens without stopwords: the unit of title comparison. */
export function titleTokens(title: string): Set<string> {
  const tokens = cleanTitle(title)
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9+#.]+|\.(?!\w)/)
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
  return new Set(tokens);
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word, case-insensitive match. "rag" must not match "storage", and "c++" or
 * "next.js" must still match, so the boundary is "not a letter or digit" instead of \b.
 */
export function containsTerm(haystack: string, term: string): boolean {
  return countTerm(haystack, term) > 0;
}

export function countTerm(haystack: string, term: string): number {
  const needle = collapseWhitespace(term);
  if (needle.length === 0) return 0;
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(needle)}(?![a-z0-9])`, 'gi');
  return haystack.match(pattern)?.length ?? 0;
}
