/*
 * Looking a word up the way people actually type: half of it, misspelt, or by the nickname
 * a colleague used. Names win over meanings, and an exact name wins over everything.
 */

export interface SearchableWord {
  readonly id: string;
  readonly term: string;
  readonly aka: readonly string[];
  readonly short: string;
}

/** Lower case, no accents, and hyphens, underscores and runs of spaces as one space. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

/** Optimal string alignment distance: insertions, deletions, substitutions and swaps. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/** Edits forgiven for a query of this length: none below four letters, then one, then two. */
const allowedEdits = (length: number): number => (length < 4 ? 0 : length < 8 ? 1 : 2);

function nameScore(query: string, name: string): number {
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.split(' ').some((part) => part.startsWith(query))) return 70;
  if (name.includes(query)) return 60;
  const budget = allowedEdits(query.length);
  if (budget === 0) return 0;
  // A typo in the whole name, or in the stretch of it as long as the query.
  const distance = Math.min(
    editDistance(query, name),
    editDistance(query, name.slice(0, query.length)),
  );
  return distance <= budget ? 50 - distance * 10 : 0;
}

function scoreOf(word: SearchableWord, query: string): number {
  const term = nameScore(query, normalise(word.term));
  const aka = Math.max(0, ...word.aka.map((name) => nameScore(query, normalise(name)) - 5));
  const named = Math.max(term, aka);
  if (named > 0) return named;
  const meaning = normalise(word.short);
  return query.split(' ').every((token) => meaning.includes(token)) ? 20 : 0;
}

/** The words that match, best first; ties keep the order they came in. */
export function searchWords<W extends SearchableWord>(words: readonly W[], query: string): W[] {
  const q = normalise(query);
  if (q === '') return [...words];
  return words
    .map((word, index) => ({ word, index, score: scoreOf(word, q) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((hit) => hit.word);
}
