export type Chunk = { id: string; text: string };

// Windows of `size` words that start `size - overlap` words apart. The last window stops at
// the end of the text, so no chunk is a tail already covered by the one before it.
export function chunk(docId: string, text: string, size: number, overlap: number): Chunk[] {
  if (size < 1 || overlap < 0 || overlap >= size) {
    throw new Error('size must be 1 or more, and overlap between 0 and size - 1');
  }
  const words = text.split(/\s+/).filter((word) => word !== '');
  const chunks: Chunk[] = [];
  const step = size - overlap;
  for (let start = 0; start < words.length; start += step) {
    chunks.push({ id: `${docId}#${chunks.length}`, text: words.slice(start, start + size).join(' ') });
    if (start + size >= words.length) break;
  }
  return chunks;
}
