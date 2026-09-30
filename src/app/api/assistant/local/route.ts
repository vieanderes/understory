import { limited } from '@/adapters/assistant/server/rate-limit';
import { cliAvailable, runClaudeCli } from '@/adapters/assistant/server/claude-cli';
import { localCliAllowed, localCliEnabled } from '@/adapters/assistant/server/local-guard';
import {
  assistantBodySchema,
  NDJSON_HEADERS,
  ndjsonStream,
  readBody,
} from '@/adapters/assistant/protocol';

/*
 * The local Claude account provider: `claude -p` with the account logged in on this
 * machine. It exists only when the server is the candidate's own machine (development,
 * or ASSISTANT_LOCAL_CLI=1 for `pnpm start`) and the request comes from localhost.
 * Anywhere else the route answers 404, as if it were not there.
 */

export const dynamic = 'force-dynamic';

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

/** Whether the panel may offer this provider. */
export async function GET(request: Request) {
  if (!localCliAllowed(request)) return notFound();
  const tooMany = await limited(request, 'bridge');
  if (tooMany) return tooMany;
  const available = localCliEnabled(process.env) && (await cliAvailable());
  return Response.json({ available }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!localCliAllowed(request)) return notFound();
  const tooMany = await limited(request, 'reply');
  if (tooMany) return tooMany;

  const parsed = await readBody(request, assistantBodySchema);
  if (!parsed.ok) return parsed.response;

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (request.signal.aborted) abort();
  request.signal.addEventListener('abort', abort, { once: true });

  const events = runClaudeCli(parsed.body, controller.signal);
  return new Response(ndjsonStream(events, abort), { headers: NDJSON_HEADERS });
}
