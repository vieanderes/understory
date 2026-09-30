import type { Embedder } from './contracts';

/**
 * A deterministic stand-in for an embedding model: a hashed bag of words, normalised to
 * unit length. It knows nothing about meaning, so "sign in" and "log in" only match on
 * "in". That is on purpose: retrieval failures you see in the eval are real failures of
 * lexical matching, which is what a keyword baseline would give you.
 */

const STOP_WORDS = new Set(
  'a an and are as at be by can do does for from how i if in is it its me my of on or our so that the then this to we what when where which who why will with you your'.split(
    ' ',
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((word) => !STOP_WORDS.has(word))
    .map((word) => (word.length > 4 ? word.replace(/(ing|ed|es|s)$/, '') : word));
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createFakeEmbedder(dimensions = 512): Embedder & { calls: number } {
  const embedder = {
    calls: 0,
    async embed(texts: string[]): Promise<number[][]> {
      embedder.calls += 1;
      return texts.map((text) => {
        const vector = new Array<number>(dimensions).fill(0);
        for (const token of tokenize(text)) {
          const hash = fnv1a(token);
          vector[hash % dimensions]! += hash & 0x80000000 ? -1 : 1;
        }
        const norm = Math.hypot(...vector);
        return norm === 0 ? vector : vector.map((value) => value / norm);
      });
    },
  };
  return embedder;
}
