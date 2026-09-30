import type { Chunk, Doc, Embedder, Generate } from '../fixtures/contracts';

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

export function chunkMarkdown(doc: Doc, options: ChunkOptions = {}): Chunk[] {
  void doc;
  void options;
  throw new Error('Not implemented');
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  void a;
  void b;
  throw new Error('Not implemented');
}

export function topK<T>(
  query: readonly number[],
  items: ReadonlyArray<{ vector: readonly number[]; item: T }>,
  k: number,
): Array<{ item: T; score: number }> {
  void query;
  void items;
  void k;
  throw new Error('Not implemented');
}

export async function buildIndex(chunks: Chunk[], embedder: Embedder): Promise<Index> {
  void chunks;
  void embedder;
  throw new Error('Not implemented');
}

export async function answer(
  question: string,
  index: Index,
  options: AnswerOptions = {},
): Promise<Answer> {
  void question;
  void index;
  void options;
  throw new Error('Not implemented');
}
