import { limited } from '@/adapters/assistant/server/rate-limit';
import { z } from 'zod';
import { getBridgeStore } from '@/adapters/assistant/server/bridge-store';
import { pairingCodeSchema } from '@/adapters/assistant/pairing';
import { contextSchema, errorResponse, readBody, turnSchema } from '@/adapters/assistant/protocol';

/*
 * The simulator tab's side of the MCP bridge (the app's side is /api/mcp).
 *   POST { type: 'ask', code, turns, context }  -> { questionId, since }
 *   POST { type: 'context', code, context }     -> { ok: true }
 *   GET  ?code=ABCDEFGH&since=3                 -> { replies, agentSeenAt }
 * The tab polls GET for replies numbered above `since`.
 */

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ask'),
    code: pairingCodeSchema,
    turns: z
      .array(turnSchema)
      .min(1)
      .max(200)
      .refine((turns) => turns.at(-1)?.role === 'user', 'The last turn must be a question.'),
    context: contextSchema,
  }),
  z.object({ type: z.literal('context'), code: pairingCodeSchema, context: contextSchema }),
]);

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const tooMany = limited(request, 'bridge');
  if (tooMany) return tooMany;
  const parsed = await readBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const store = getBridgeStore();
  const body = parsed.body;
  if (body.type === 'context') {
    await store.putContext(body.code, body.context);
    return Response.json({ ok: true }, { headers: NO_STORE });
  }
  return Response.json(await store.ask(body.code, body.turns, body.context), { headers: NO_STORE });
}

export async function GET(request: Request) {
  const tooMany = limited(request, 'bridge');
  if (tooMany) return tooMany;
  const params = new URL(request.url).searchParams;
  const code = pairingCodeSchema.safeParse(params.get('code') ?? '');
  if (!code.success)
    return errorResponse('failed', 'The pairing code is missing or malformed.', 400);
  const since = Number(params.get('since') ?? '0');
  if (!Number.isInteger(since) || since < 0) {
    return errorResponse('failed', 'since must be a whole number.', 400);
  }
  return Response.json(await getBridgeStore().repliesSince(code.data, since), {
    headers: NO_STORE,
  });
}
