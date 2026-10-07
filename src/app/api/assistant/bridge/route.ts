import * as z from '@/core/zod';
import { clientOf, limited, recordFailure } from '@/adapters/assistant/server/rate-limit';
import { getBridgeStore, sharedStoreMissing } from '@/adapters/assistant/server/bridge-store';
import {
  PAIRING_HEADER,
  pairingCodeSchema,
  TAB_SECRET_HEADER,
  tabSecretSchema,
} from '@/adapters/assistant/pairing';
import { contextSchema, errorResponse, readBody, turnSchema } from '@/adapters/assistant/protocol';

/*
 * The simulator tab's side of the MCP bridge (the app's side is /api/mcp). Every request
 * carries the pairing code and the tab's secret in headers (x-pairing-code, x-tab-secret).
 *   POST { type: 'ask', turns, context }        -> { questionId, since }
 *   POST { type: 'context', context }           -> { ok: true }
 *   POST { type: 'decide', connection, allow }  -> { ok: true, decided }
 *   POST { type: 'end' }                        -> { ok: true }
 *   GET  ?since=3[&open=1]                      -> { replies, agentSeenAt, connection }
 * The tab polls GET for replies numbered above `since`, and for a connection to allow.
 */

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ask'),
    turns: z
      .array(turnSchema)
      .min(1)
      .max(200)
      .refine((turns) => turns.at(-1)?.role === 'user', 'The last turn must be a question.'),
    context: contextSchema,
  }),
  z.object({ type: z.literal('context'), context: contextSchema }),
  z.object({
    type: z.literal('decide'),
    connection: z.string().min(1).max(100),
    allow: z.boolean(),
  }),
  z.object({ type: z.literal('end') }),
]);

const NO_STORE = { 'Cache-Control': 'no-store' };

function credentials(request: Request) {
  const code = pairingCodeSchema.safeParse(request.headers.get(PAIRING_HEADER) ?? '');
  const secret = tabSecretSchema.safeParse(request.headers.get(TAB_SECRET_HEADER) ?? '');
  return code.success && secret.success ? { code: code.data, secret: secret.data } : null;
}

const MALFORMED = () =>
  errorResponse('failed', 'The pairing code or tab secret is malformed.', 400);

const NO_SHARED_STORE = () =>
  errorResponse(
    'unavailable',
    'Claude via MCP is not set up on this server: it needs a shared store. Choose another assistant for now.',
  );

/** Another tab holds this code: counted, since a stranger guessing looks like this. */
async function forbidden(request: Request): Promise<Response> {
  await recordFailure(getBridgeStore().backend, clientOf(request));
  return errorResponse(
    'unauthorised',
    'Another tab is using this pairing code. Make a new code in the assistant’s connection settings.',
    403,
  );
}

export async function POST(request: Request) {
  const tooMany = await limited(request, 'bridge');
  if (tooMany) return tooMany;
  if (sharedStoreMissing()) return NO_SHARED_STORE();
  const pair = credentials(request);
  if (!pair) return MALFORMED();
  const parsed = await readBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const store = getBridgeStore();
  const body = parsed.body;
  const { code, secret } = pair;

  const result =
    body.type === 'ask'
      ? await store.ask(code, secret, body.turns, body.context)
      : body.type === 'context'
        ? await store.putContext(code, secret, body.context)
        : body.type === 'decide'
          ? await store.decide(code, secret, body.connection, body.allow)
          : await store.end(code, secret);
  if (!result.ok) return forbidden(request);

  const payload =
    body.type === 'ask'
      ? result.value
      : body.type === 'decide'
        ? { ok: true, decided: result.value }
        : { ok: true };
  return Response.json(payload, { headers: NO_STORE });
}

export async function GET(request: Request) {
  const tooMany = await limited(request, 'bridge');
  if (tooMany) return tooMany;
  if (sharedStoreMissing()) return NO_SHARED_STORE();
  const pair = credentials(request);
  if (!pair) return MALFORMED();
  const params = new URL(request.url).searchParams;
  const since = Number(params.get('since') ?? '0');
  if (!Number.isInteger(since) || since < 0) {
    return errorResponse('failed', 'since must be a whole number.', 400);
  }
  const store = getBridgeStore();
  const result = await store.repliesSince(pair.code, pair.secret, since);
  if (!result.ok) return forbidden(request);
  // The panel says now and then that the tab is still open, for an app that keeps listening.
  if (params.get('open') === '1') await store.tabOpen(pair.code, pair.secret);
  return Response.json(result.value, { headers: NO_STORE });
}
