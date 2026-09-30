import { limited } from '@/adapters/assistant/server/rate-limit';
import { mapAnthropicError, openAnthropicReply } from '@/adapters/assistant/server/anthropic';
import {
  assistantBodySchema,
  errorResponse,
  KEY_HEADER,
  NDJSON_HEADERS,
  ndjsonStream,
  readBody,
} from '@/adapters/assistant/protocol';

/*
 * The API key provider (docs/ONLINE-TEST.md, "The assistant"). The candidate's own key
 * arrives in a header on every request and goes straight to the SDK: it is never logged,
 * never stored and never echoed back. The reply streams as NDJSON (see protocol.ts).
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const tooMany = await limited(request, 'reply');
  if (tooMany) return tooMany;
  const apiKey = request.headers.get(KEY_HEADER)?.trim();
  if (!apiKey) {
    return errorResponse('unauthorised', 'Add your Anthropic API key to use the assistant.');
  }

  const parsed = await readBody(request, assistantBodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const reply = await openAnthropicReply(apiKey, parsed.body, request.signal);
    return new Response(ndjsonStream(reply.events), { headers: NDJSON_HEADERS });
  } catch (error) {
    const mapped = mapAnthropicError(error);
    return errorResponse(mapped.code, mapped.message, mapped.status);
  }
}
