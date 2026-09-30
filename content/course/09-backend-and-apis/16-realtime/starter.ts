// Frames a model's answer, chunk by chunk, as server-sent events.
export function frameAnswer(chunks: string[]): string {
  // It sends each chunk raw and never says the answer is finished.
  let text = '';
  for (const chunk of chunks) {
    text += `data: ${chunk}\n`;
  }
  return text;
}
