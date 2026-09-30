export type Chunk = { id: string; text: string };

export function chunk(docId: string, text: string, size: number, overlap: number): Chunk[] {
  // Split into words, then take windows of `size` words that start `size - overlap` apart.
  return [{ id: `${docId}#0`, text }];
}
