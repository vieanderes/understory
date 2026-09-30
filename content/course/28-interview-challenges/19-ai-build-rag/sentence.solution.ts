// Sentences end at . ! or ?, and any text after the last one counts as a sentence too.
export function sentences(text: string): string[] {
  const found = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return found.map((sentence) => sentence.trim()).filter((sentence) => sentence !== '');
}

export function chunkSentences(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  for (const sentence of sentences(text)) {
    if (current.length > 0 && [...current, sentence].join(' ').length > maxChars) {
      chunks.push(current.join(' '));
      const last = current[current.length - 1] as string;
      // Repeat the last sentence as overlap, but only if it fits beside the new one.
      current = `${last} ${sentence}`.length <= maxChars ? [last, sentence] : [sentence];
    } else {
      // An empty chunk takes any sentence, so one longer than the limit stays whole.
      current.push(sentence);
    }
  }
  if (current.length > 0) chunks.push(current.join(' '));
  return chunks;
}
