export interface Answer {
  status: number;
  body: { title: string } | { error: string };
}

export function answerSuggestion(text: string): Answer {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: 400, body: { error: 'Send JSON' } };
  }
  const title =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>).title : undefined;
  if (typeof title !== 'string' || title.trim() === '') {
    return { status: 400, body: { error: 'Add a title' } };
  }
  return { status: 201, body: { title: title.trim() } };
}
