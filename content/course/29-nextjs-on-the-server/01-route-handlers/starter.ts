export interface Answer {
  status: number;
  body: { title: string } | { error: string };
}

export function answerSuggestion(text: string): Answer {
  // Replace this. It trusts the body, so bad JSON throws and becomes a 500.
  const body = JSON.parse(text);
  return { status: 201, body: { title: body.title } };
}
