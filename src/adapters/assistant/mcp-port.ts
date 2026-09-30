import {
  AssistantError,
  type AssistantContext,
  type AssistantPort,
  type AssistantRequest,
  type AssistantSignal,
} from '@/core/ports/assistant';
import { PAIRING_HEADER, TAB_SECRET_HEADER, type Pairing } from './pairing';
import type { BridgeConnection, BridgeReply } from './server/bridge-store';
import { assistantFetch, errorFromResponse, toAbortSignal } from './stream';

/*
 * The MCP provider. The question goes to the bridge; the candidate's Claude app picks it
 * up through /api/mcp and answers with the `reply` tool; this port polls the bridge until
 * that answer arrives and yields it whole. The panel says it is waiting in the meantime.
 * Every call carries the pairing code and the tab's secret in headers (pairing.ts).
 */

const BRIDGE = '/api/assistant/bridge';

function pairingHeaders(pairing: Pairing, json = false): Record<string, string> {
  return {
    [PAIRING_HEADER]: pairing.code,
    [TAB_SECRET_HEADER]: pairing.secret,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export interface McpPortOptions {
  /** The pairing code the panel shows, and the tab's secret. */
  pairing: Pairing;
  fetcher?: typeof fetch;
  pollMs?: number;
  /** How long to wait for the app before giving up. */
  timeoutMs?: number;
  sleep?: (ms: number, signal?: AssistantSignal) => Promise<void>;
  now?: () => number;
}

function defaultSleep(ms: number, signal?: AssistantSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export const MCP_TIMEOUT_MS = 5 * 60 * 1000;

export function createMcpPort(options: McpPortOptions): AssistantPort {
  const fetcher = options.fetcher ?? ((...args) => fetch(...args));
  const pollMs = options.pollMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? MCP_TIMEOUT_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  return {
    id: 'mcp',
    async *send(request: AssistantRequest, signal?: AssistantSignal) {
      const abortSignal = toAbortSignal(signal);
      const asked = await assistantFetch(fetcher, BRIDGE, {
        method: 'POST',
        headers: pairingHeaders(options.pairing, true),
        body: JSON.stringify({
          type: 'ask',
          turns: request.turns,
          context: request.context,
        }),
        signal: abortSignal,
        cache: 'no-store',
      });
      if (!asked) return;
      if (!asked.ok) throw await errorFromResponse(asked);
      const { questionId, since } = (await asked.json()) as { questionId: number; since: number };

      const deadline = now() + timeoutMs;
      while (!signal?.aborted) {
        if (now() >= deadline) {
          throw new AssistantError(
            'unavailable',
            'No reply from your Claude app in 5 minutes. Check it is connected, then ask again.',
          );
        }
        const polled = await assistantFetch(fetcher, `${BRIDGE}?since=${since}`, {
          headers: pairingHeaders(options.pairing),
          signal: abortSignal,
          cache: 'no-store',
        });
        if (!polled) return;
        if (!polled.ok) throw await errorFromResponse(polled);
        const { replies } = (await polled.json()) as { replies: BridgeReply[] };
        // Prefer the answer to this question; take any later reply as the next best thing.
        const reply =
          replies.find((candidate) => candidate.questionId === questionId) ?? replies.at(-1);
        if (reply) {
          yield reply.text;
          return;
        }
        await sleep(pollMs, signal);
      }
    },
  };
}

/** Keeps the app's view of the task and code current between questions. */
export async function pushMcpContext(
  pairing: Pairing,
  context: AssistantContext,
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<void> {
  try {
    await fetcher(BRIDGE, {
      method: 'POST',
      headers: pairingHeaders(pairing, true),
      body: JSON.stringify({ type: 'context', context }),
      cache: 'no-store',
    });
  } catch {
    // Best effort: the next question carries the context anyway.
  }
}

/** What the panel shows about the app's connection. */
export interface McpStatus {
  /** The connection the learner allowed, if any. */
  allowed: BridgeConnection | null;
  /** A connection waiting for Allow or Deny. */
  request: BridgeConnection | null;
  /** When the app last used a tool with this code. */
  agentSeenAt: number | null;
  /** Another tab holds this code: the panel makes a new one. */
  taken: boolean;
}

export const NO_MCP_STATUS: McpStatus = {
  allowed: null,
  request: null,
  agentSeenAt: null,
  taken: false,
};

/** Reads the connection, without touching the replies (since is past them all). */
export async function fetchMcpStatus(
  pairing: Pairing,
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<McpStatus | undefined> {
  try {
    const response = await fetcher(`${BRIDGE}?since=${Number.MAX_SAFE_INTEGER}`, {
      headers: pairingHeaders(pairing),
      cache: 'no-store',
    });
    if (response.status === 403) return { ...NO_MCP_STATUS, taken: true };
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      agentSeenAt: number | null;
      connection: { allowed: BridgeConnection | null; request: BridgeConnection | null };
    };
    return {
      allowed: body.connection.allowed,
      request: body.connection.request,
      agentSeenAt: body.agentSeenAt,
      taken: false,
    };
  } catch {
    return undefined;
  }
}

/** The learner allows or refuses the connection waiting on this code. */
export async function decideMcpConnection(
  pairing: Pairing,
  connection: string,
  allow: boolean,
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<boolean> {
  try {
    const response = await fetcher(BRIDGE, {
      method: 'POST',
      headers: pairingHeaders(pairing, true),
      body: JSON.stringify({ type: 'decide', connection, allow }),
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Ends the session behind a code, so it stops working at once. */
export async function endMcpSession(
  pairing: Pairing,
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<void> {
  try {
    await fetcher(BRIDGE, {
      method: 'POST',
      headers: pairingHeaders(pairing, true),
      body: JSON.stringify({ type: 'end' }),
      cache: 'no-store',
      keepalive: true,
    });
  } catch {
    // Best effort: an idle session expires by itself.
  }
}
