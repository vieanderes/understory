import { says, wordPattern } from './match';

/*
 * What a lesson could add to the vocabulary: the words it already says, to pin, and the key
 * terms it introduces that no word covers yet, to write. A key term is one the lesson bolds,
 * since the writing guide bolds a term where it is first taught, or one its notes define.
 */

const BOLD = /\*\*([^*\n]{2,60})\*\*/g;

/** Bold terms, without code ticks, first spelling kept, compared without case. */
export function keyTermsOf(texts: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const text of texts) {
    for (const match of text.matchAll(BOLD)) {
      const term = (match[1] ?? '').replace(/`/g, '').trim();
      const key = term.toLowerCase();
      if (term !== '' && !seen.has(key)) seen.set(key, term);
    }
  }
  return [...seen.values()];
}

export interface WordGaps {
  /** Ids of existing words the lesson says, the most said first. */
  toPin: string[];
  /** Key terms no word or alias covers. */
  missing: string[];
}

export function wordGaps(
  texts: readonly string[],
  definedTerms: readonly string[],
  words: readonly { id: string; names: readonly string[] }[],
): WordGaps {
  const all = texts.join('\n');
  const count = (names: readonly string[]) =>
    names.reduce(
      (n, name) => n + (all.match(new RegExp(wordPattern(name).source, 'giu'))?.length ?? 0),
      0,
    );
  const toPin = words
    .map((word) => ({ id: word.id, said: count(word.names) }))
    .filter((w) => w.said > 0)
    .sort((a, b) => b.said - a.said)
    .map((w) => w.id);
  const names = words.flatMap((w) => w.names);
  const candidates = [...keyTermsOf(texts), ...definedTerms];
  const missing = candidates.filter(
    (term, i) =>
      candidates.findIndex((t) => t.toLowerCase() === term.toLowerCase()) === i &&
      // Covered when the term is a name, give or take a plural: "closures" is "closure".
      !names.some((name) => says(term, [name]) && term.length <= name.length + 3),
  );
  return { toPin, missing };
}
