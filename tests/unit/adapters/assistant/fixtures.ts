import type { AssistantContext } from '@/core/ports/assistant';

export const CONTEXT: AssistantContext = {
  taskTitle: 'Longest run',
  statement: 'Return the length of the longest run of equal values. function solution(a)',
  language: 'javascript',
  code: 'function solution(a) {\n  return 0;\n}',
  output: '',
};

export const BODY = {
  turns: [{ role: 'user' as const, text: 'What does a run mean here?' }],
  context: CONTEXT,
};

export function ndjson(lines: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      controller.close();
    },
  });
}

export async function readAll(stream: ReadableStream<Uint8Array> | null): Promise<unknown[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of iterable) out.push(chunk);
  return out;
}

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
