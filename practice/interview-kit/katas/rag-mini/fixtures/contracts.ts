/** Types shared by the kata, the fake embedder and the optional real model. */

export interface Doc {
  id: string;
  markdown: string;
}

export interface Chunk {
  /** `${docId}#${n}`, numbered from 0 within the document. */
  id: string;
  docId: string;
  /** The nearest heading above the text, without the # marks. Empty before any heading. */
  heading: string;
  text: string;
}

export interface Embedder {
  /** One vector per text, all the same length. */
  embed(texts: string[]): Promise<number[][]>;
}

export interface Source {
  /** The number the answer cites it by, as in [1]. */
  n: number;
  chunk: Chunk;
}

/** Writes an answer from numbered sources, citing them as [n]. */
export type Generate = (input: { question: string; sources: Source[] }) => Promise<string>;
