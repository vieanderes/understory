// Frames a model's answer, chunk by chunk, as server-sent events.
export function frameAnswer(chunks: string[]): string {
  let text = '';
  for (const chunk of chunks) {
    if (chunk === '') continue;
    text += `data: ${JSON.stringify({ text: chunk })}\n\n`;
  }
  return text + 'data: [DONE]\n\n';
}
