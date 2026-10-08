/*
 * Finding a word in running text. The glossary checks, the lesson links and the gap drill
 * all have to agree on what counts as "the word is here", so they share this one rule:
 * any case, a plural, hyphen or space between parts, and never inside a longer word.
 */

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Letters and digits on either side mean the match is part of a longer word. */
const BEFORE = '(?<![\\p{L}\\p{N}_])';
const AFTER = '(?![\\p{L}\\p{N}_])';

export function wordPattern(word: string, flags = 'iu'): RegExp {
  const body = word
    .trim()
    .split(/[\s-]+/)
    .map(escape)
    .join('[\\s-]+');
  const plural = /[\p{L}]$/u.test(word.trim()) ? "(?:e?s|'s)?" : '';
  return new RegExp(`${BEFORE}${body}${plural}${AFTER}`, flags);
}

/** True when `text` says any of `words`. */
export function says(text: string, words: readonly string[]): boolean {
  return words.some((word) => word.trim() !== '' && wordPattern(word).test(text));
}

/** The first place `text` says any of `words`, longest word first so "pure function" beats "function". */
export function firstMention(
  text: string,
  words: readonly string[],
): { index: number; length: number } | undefined {
  const sorted = [...words].filter((w) => w.trim() !== '').sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    const found = wordPattern(word).exec(text);
    if (found) return { index: found.index, length: found[0].length };
  }
  return undefined;
}
