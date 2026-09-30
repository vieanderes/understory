import type { Chunk, Doc, Embedder, Generate, Source } from '../fixtures/contracts';

export interface ChunkOptions {
  size?: number;
  overlap?: number;
}

export interface Hit {
  chunk: Chunk;
  score: number;
}

export interface Index {
  search(query: string, k: number): Promise<Hit[]>;
}

export interface Citation {
  n: number;
  docId: string;
  chunkId: string;
  heading: string;
}

export interface Answer {
  status: 'answered' | 'refused';
  text: string;
  citations: Citation[];
}

export interface AnswerOptions {
  k?: number;
  threshold?: number;
  generate?: Generate;
}

export const REFUSAL = "I don't have that information.";

interface Section {
  heading: string;
  body: string;
}

function sections(markdown: string): Section[] {
  const result: Section[] = [];
  let current: Section = { heading: '', body: '' };
  for (const line of markdown.split('\n')) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      result.push(current);
      current = { heading: heading[1]!.trim(), body: '' };
    } else {
      current.body += `${line}\n`;
    }
  }
  result.push(current);
  return result.filter((section) => section.body.trim() !== '');
}

/**
 * Windows of whole words up to `size` characters. Each window after the first repeats the
 * trailing words of the one before, up to `overlap` characters, so a sentence split at a
 * boundary is still whole in one of the two chunks.
 */
function windows(words: string[], size: number, overlap: number): string[] {
  const result: string[] = [];
  let start = 0;
  while (start < words.length) {
    let end = start;
    let length = 0;
    while (end < words.length) {
      const added = (end > start ? 1 : 0) + words[end]!.length;
      if (end > start && length + added > size) break;
      length += added;
      end += 1;
    }
    result.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;

    let back = end;
    let carried = 0;
    while (back - 1 > start && carried + words[back - 1]!.length + 1 <= overlap) {
      back -= 1;
      carried += words[back]!.length + 1;
    }
    start = back;
  }
  return result;
}

export function chunkMarkdown(doc: Doc, { size = 500, overlap = 75 }: ChunkOptions = {}): Chunk[] {
  if (!(size > 0) || !(overlap >= 0) || overlap >= size) {
    throw new RangeError('overlap must be at least 0 and smaller than size');
  }
  // Chunks never cross a heading: a heading changes the topic, and mixing two topics in
  // one vector makes it a weak match for both.
  return sections(doc.markdown)
    .flatMap(({ heading, body }) =>
      windows(body.split(/\s+/).filter(Boolean), size, overlap).map((text) => ({ heading, text })),
    )
    .map((chunk, n) => ({ id: `${doc.id}#${n}`, docId: doc.id, ...chunk }));
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length)
    throw new RangeError(`Vector lengths differ: ${a.length} and ${b.length}`);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

export function topK<T>(
  query: readonly number[],
  items: ReadonlyArray<{ vector: readonly number[]; item: T }>,
  k: number,
): Array<{ item: T; score: number }> {
  // A full sort is O(n log n). Fine for thousands of chunks; beyond that, a heap of size k
  // or an approximate index (HNSW) is the answer.
  return items
    .map(({ vector, item }, order) => ({ item, score: cosine(query, vector), order }))
    .sort((x, y) => y.score - x.score || x.order - y.order)
    .slice(0, Math.max(0, k))
    .map(({ item, score }) => ({ item, score }));
}

export async function buildIndex(chunks: Chunk[], embedder: Embedder): Promise<Index> {
  // The heading goes into the embedded text: "Refunds" alone says more than the paragraph.
  const vectors = await embedder.embed(chunks.map((c) => `${c.heading}\n${c.text}`));
  const items = chunks.map((chunk, i) => ({ vector: vectors[i]!, item: chunk }));
  return {
    async search(query, k) {
      const [vector] = await embedder.embed([query]);
      return topK(vector!, items, k).map(({ item, score }) => ({ chunk: item, score }));
    },
  };
}

function firstSentence(text: string): string {
  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

/** Without a model: quote the opening sentence of each source, cited. */
const extractive: Generate = async ({ sources }) =>
  sources.map(({ n, chunk }) => `${firstSentence(chunk.text)} [${n}]`).join(' ');

const refusal = (): Answer => ({ status: 'refused', text: REFUSAL, citations: [] });

export async function answer(
  question: string,
  index: Index,
  { k = 3, threshold = 0.2, generate = extractive }: AnswerOptions = {},
): Promise<Answer> {
  const hits = (await index.search(question, k)).filter((hit) => hit.score >= threshold);
  // Refusing before calling the model is cheaper and more reliable than asking the model
  // to notice that weak context does not answer the question.
  if (hits.length === 0) return refusal();

  const sources: Source[] = hits.map((hit, i) => ({ n: i + 1, chunk: hit.chunk }));
  const text = (await generate({ question, sources })).trim();

  const cited = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))];
  // An answer that cites nothing, or cites a source it was not given, cannot be checked
  // against the documents, so it is not shown.
  if (cited.length === 0 || cited.some((n) => !sources.some((s) => s.n === n))) return refusal();

  const citations = cited
    .sort((a, b) => a - b)
    .map((n) => {
      const { chunk } = sources[n - 1]!;
      return { n, docId: chunk.docId, chunkId: chunk.id, heading: chunk.heading };
    });
  return { status: 'answered', text, citations };
}
