import { z } from 'zod';
import { limited } from '@/adapters/assistant/server/rate-limit';
import { plannerCourseText } from '@/adapters/assistant/server/planner-course';
import {
  contextSchema,
  errorResponse,
  NDJSON_HEADERS,
  ndjsonStream,
  readBody,
  turnSchema,
  type StreamEvent,
} from '@/adapters/assistant/protocol';
import {
  buildOpenAiChatRequest,
  DEFAULT_OPENAI_MODEL,
  mapOpenAiStatus,
  readOpenAiStream,
  resolveCompletionsUrl,
} from '@/adapters/assistant/openai-compatible';
import { AssistantError } from '@/core/ports/assistant';

/*
 * The OpenAI-compatible API provider (docs/ONLINE-TEST.md, "The assistant").
 * The candidate's chosen base URL arrives in x-base-url and key in x-api-key or authorization.
 * The key is forwarded directly to the configured endpoint and never stored.
 * The reply streams as NDJSON (see protocol.ts).
 */

export const dynamic = 'force-dynamic';

export const compatibleBodySchema = z.object({
  turns: z
    .array(turnSchema)
    .min(1)
    .max(200)
    .refine((turns) => turns.at(-1)?.role === 'user', 'The last turn must be a question.'),
  context: contextSchema,
  model: z.string().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const tooMany = await limited(request, 'reply');
  if (tooMany) return tooMany;

  const baseUrl = request.headers.get('x-base-url')?.trim();
  if (!baseUrl) {
    return errorResponse(
      'unavailable',
      'Add your OpenAI-compatible base URL to use the assistant.',
      400,
    );
  }

  const apiKey =
    request.headers.get('x-api-key')?.trim() ||
    request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim();

  const parsed = await readBody(request, compatibleBodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const course =
      parsed.body.context.mode === 'planner' ? await plannerCourseText(request.url) : undefined;
    const endpoint = resolveCompletionsUrl(baseUrl);
    const chatPayload = buildOpenAiChatRequest(
      { turns: parsed.body.turns, context: parsed.body.context },
      parsed.body.model || DEFAULT_OPENAI_MODEL,
      course,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(chatPayload),
        signal: request.signal,
      });
    } catch {
      return errorResponse(
        'unavailable',
        'Could not reach the provider. Check the base URL and connection.',
        503,
      );
    }

    if (!response.ok) {
      let errorMessage: string | undefined;
      try {
        const errJson = (await response.json()) as {
          error?: { message?: string };
          message?: string;
        };
        errorMessage = errJson.error?.message || errJson.message;
      } catch {
        // Not JSON
      }
      const mapped = mapOpenAiStatus(response.status, errorMessage);
      return errorResponse(mapped.code, mapped.message, response.status);
    }

    if (!response.body) {
      return errorResponse('failed', 'The provider sent an empty reply.', 502);
    }

    async function* events(): AsyncGenerator<StreamEvent> {
      try {
        for await (const text of readOpenAiStream(response.body!)) {
          yield { type: 'text', text };
        }
        yield { type: 'done' };
      } catch (err) {
        if (request.signal.aborted) return;
        const code = err instanceof AssistantError ? err.code : 'failed';
        const msg = err instanceof Error ? err.message : 'The reply broke off.';
        yield { type: 'error', code, message: msg };
      }
    }

    return new Response(ndjsonStream(events()), { headers: NDJSON_HEADERS });
  } catch (error) {
    const code = error instanceof AssistantError ? error.code : 'failed';
    const msg =
      error instanceof Error ? error.message : 'The assistant failed to answer. Ask again.';
    return errorResponse(code, msg);
  }
}
