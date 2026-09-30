// Sentences end at . ! or ?, and any text after the last one counts as a sentence too.
export function sentences(text: string): string[] {
  const found = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return found.map((sentence) => sentence.trim()).filter((sentence) => sentence !== '');
}

export function chunkSentences(text: string, maxChars: number): string[] {
  // Cuts every maxChars characters, often in the middle of a sentence.
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += maxChars) {
    chunks.push(text.slice(start, start + maxChars).trim());
  }
  return chunks;
}
