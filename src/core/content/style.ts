/*
 * Text checks shared by the validator rules. Everything here works on a string and knows
 * nothing about steps, so each check is testable alone and reusable by the news pipeline.
 */

export const MAX_SENTENCE_WORDS = 28;
export const MAX_CODE_LINES = 15;

/** docs/CONTENT-GUIDE.md, style rule 4. Matched as whole words, in any case. */
export const BANNED_WORDS = [
  'basically',
  'simply',
  'just',
  'powerful',
  'robust',
  'easy',
  'obviously',
  'please',
  'successfully',
] as const;

// Built from its code point, so this file obeys the rule it enforces whatever a formatter does.
export const EM_DASH = String.fromCharCode(0x2014);

const FENCE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
const INLINE_CODE = /`[^`\n]*`/g;

export interface Fence {
  language: string;
  lines: number;
}

export function fencesOf(markdown: string): Fence[] {
  return [...markdown.matchAll(FENCE)].map((match) => {
    const [opening = '', ...rest] = match[0].split('\n');
    return {
      language: opening.replace(/^(```|~~~)/, '').trim(),
      // The closing fence is the last element and is not a line of code.
      lines: rest.length - 1,
    };
  });
}

/**
 * The words a person reads. Code is replaced by the placeholder `code`, because a banned
 * word, a tag or an exclamation mark inside code is the subject matter, not the style.
 */
export function proseOnly(markdown: string): string {
  return markdown
    .replace(FENCE, '\n\n')
    .replace(INLINE_CODE, 'code')
    .replace(/\]\([^)]*\)/g, ']');
}

/** Sentence ends, blank lines and list markers all end a sentence. */
const SENTENCE_BREAK = /(?<=[.?!:;])\s+|\n\s*\n|\n\s*(?:[-*+]|\d+\.)\s+|^\s*(?:[-*+]|\d+\.)\s+/m;

export function sentencesOf(markdown: string): string[] {
  return proseOnly(markdown)
    .split(new RegExp(SENTENCE_BREAK.source, 'gm'))
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence));
}

export const wordCount = (sentence: string): number =>
  sentence.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/** The banned words found, spelt the way the author wrote them so they are quick to find. */
export function bannedWordsIn(markdown: string): string[] {
  const prose = proseOnly(markdown);
  return BANNED_WORDS.flatMap((word) => {
    const found = new RegExp(`\\b${word}\\b`, 'i').exec(prose);
    return found ? [found[0]] : [];
  });
}

/** cyrb53: a small, stable 53-bit string hash, in base 36. Not for security. */
export function termHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/*
 * A withdrawn single-product setting and real names that must never become lesson material
 * (AGENTS.md, law 10). Stored as hashes of the lower-case, space-free term, so the list
 * does not publish the names it keeps out. Code is searched too, because a setting hides
 * as easily in a string literal.
 */
export const WITHDRAWN_SETTING_HASHES: ReadonlySet<string> = new Set([
  '840go6g3c0',
  '22ubzkpz5qr',
  '1ghb19vkc72',
  '2f8w32vli6h',
  '13xmodylsp7',
  '1j6nq45axkl',
  'o2qzirl2bt',
  'dob9cd0e2p',
]);

/**
 * Words, then each word without a plural s, then each pair of neighbours joined, so a term
 * is found as "Two Words", "two-words", "twoWords" or "twowords".
 */
function termCandidates(text: string): { term: string; shown: string }[] {
  const words = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const lower = words.map((word) => word.toLowerCase());
  return [
    ...lower.map((term, i) => ({ term, shown: words[i]! })),
    ...lower.map((term, i) => ({ term: term.replace(/s$/, ''), shown: words[i]! })),
    ...lower.slice(1).map((term, i) => ({
      term: lower[i]! + term,
      shown: `${words[i]!} ${words[i + 1]!}`,
    })),
  ];
}

export const withdrawnSettingTermsIn = (
  text: string,
  hashes: ReadonlySet<string> = WITHDRAWN_SETTING_HASHES,
): string[] => [
  ...new Set(
    termCandidates(text)
      .filter(({ term }) => hashes.has(termHash(term)))
      .map(({ shown }) => shown),
  ),
];

export const hasRawHtml = (markdown: string): boolean =>
  /<\/?[a-zA-Z][^>]*>/.test(proseOnly(markdown));

export const hasLevelOneHeading = (markdown: string): boolean =>
  /^ {0,3}#\s/m.test(markdown.replace(FENCE, ''));

export const lineCount = (code: string): number => code.replace(/\n+$/, '').split('\n').length;
