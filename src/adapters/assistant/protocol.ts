import { z } from 'zod';
import type { AssistantErrorCode } from '@/core/ports/assistant';

/*
 * The wire format shared by the assistant routes and the browser adapters.
 *
 * A request is JSON: { turns, context, model? }. A reply is NDJSON
 * (`application/x-ndjson`), one event per line:
 *
 *   {"type":"text","text":"..."}                    a chunk of the reply, in order
 *   {"type":"error","code":"failed","message":"..."} the reply broke off; nothing follows
 *   {"type":"done"}                                  the reply is complete
 *
 * NDJSON rather than plain text because an error can arrive after the first chunk, and a
 * plain stream cannot tell "the model stopped" from "the connection dropped". Errors found
 * before streaming starts come back as an HTTP status with { error: { code, message } }.
 */

export const ASSISTANT_MODELS = [
  'claude-sonnet-5-5',
  'claude-opus-5-5',
  'claude-haiku-4-5-20251001',
] as const;
export type AssistantModel = (typeof ASSISTANT_MODELS)[number];
export const DEFAULT_ASSISTANT_MODEL: AssistantModel = 'claude-sonnet-5-5';

// Generous, but bounded: a request carries the code and the whole conversation.
const MAX_TEXT = 100_000;

export const contextSchema = z.object({
  taskTitle: z.string().max(1_000),
  statement: z.string().max(MAX_TEXT),
  language: z.string().max(100),
  code: z.string().max(MAX_TEXT),
  output: z.string().max(MAX_TEXT),
  mode: z.enum(['test', 'tutor', 'guide']).optional(),
  // A few hundred tokens in practice; the ceiling only stops a tab padding the prompt.
  app: z.string().max(8_000).optional(),
});

export const turnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1).max(MAX_TEXT),
});

export const assistantBodySchema = z.object({
  turns: z
    .array(turnSchema)
    .min(1)
    .max(200)
    .refine((turns) => turns.at(-1)?.role === 'user', 'The last turn must be a question.'),
  context: contextSchema,
  model: z.enum(ASSISTANT_MODELS).optional(),
});
export type AssistantBody = z.infer<typeof assistantBodySchema>;

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'error'; code: AssistantErrorCode; message: string }
  | { type: 'done' };

/** The header the API key provider sends the candidate's key in. */
export const KEY_HEADER = 'x-anthropic-key';

export const NDJSON_HEADERS = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

const HTTP_STATUS: Record<AssistantErrorCode, number> = {
  unauthorised: 401,
  'rate-limited': 429,
  unavailable: 503,
  failed: 502,
};

export function errorResponse(code: AssistantErrorCode, message: string, status?: number) {
  return Response.json(
    { error: { code, message } },
    { status: status ?? HTTP_STATUS[code], headers: { 'Cache-Control': 'no-store' } },
  );
}

export function encodeEvent(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Turns an async source of events into an NDJSON response body. The source is pulled one
 * event at a time, so a slow reader slows the model down instead of filling memory, and a
 * cancelled response (the browser pressed Stop) calls `onCancel`.
 */
export function ndjsonStream(
  source: AsyncIterable<StreamEvent>,
  onCancel?: () => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = source[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(encodeEvent(value)));
      } catch {
        controller.enqueue(
          encoder.encode(
            encodeEvent({ type: 'error', code: 'failed', message: 'The reply broke off.' }),
          ),
        );
        controller.close();
      }
    },
    cancel() {
      onCancel?.();
      // Not awaited: a source stuck mid-await only finishes once onCancel has stopped it.
      iterator.return?.()?.catch(() => {});
    },
  });
}

/** Parses a JSON body against the schema, or answers 400 in plain words. */
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; body: T } | { ok: false; response: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: errorResponse('failed', 'The request was not JSON.', 400) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return {
      ok: false,
      response: errorResponse('failed', `The request is malformed. ${where}${issue?.message}`, 400),
    };
  }
  return { ok: true, body: parsed.data };
}

/**
 * The Messages API wants turns that alternate and open with the user. A transcript may
 * break both rules (a question sent twice after a failed reply), so runs of one role are
 * joined and anything before the first question is dropped.
 */
export function normaliseTurns(
  turns: readonly { role: 'user' | 'assistant'; text: string }[],
): { role: 'user' | 'assistant'; text: string }[] {
  const out: { role: 'user' | 'assistant'; text: string }[] = [];
  for (const turn of turns) {
    if (out.length === 0 && turn.role !== 'user') continue;
    const last = out.at(-1);
    if (last && last.role === turn.role) last.text = `${last.text}\n\n${turn.text}`;
    else out.push({ role: turn.role, text: turn.text });
  }
  return out;
}
