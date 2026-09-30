import {
  AssistantError,
  type AssistantContext,
  type AssistantPort,
  type AssistantRequest,
  type AssistantSignal,
} from '@/core/ports/assistant';
import type { BridgeReply } from './server/bridge-store';
import { assistantFetch, errorFromResponse, toAbortSignal } from './stream';

/*
 * The MCP provider. The question goes to the bridge; the candidate's Claude app picks it
 * up through /api/mcp and answers with the `reply` tool; this port polls the bridge until
 * that answer arrives and yields it whole. The panel says it is waiting in the meantime.
 */

export interface McpPortOptions {
  /** The pairing code the panel shows. */
  code: string;
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
      const asked = await assistantFetch(fetcher, '/api/assistant/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ask',
          code: options.code,
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
        const polled = await assistantFetch(
          fetcher,
          `/api/assistant/bridge?code=${encodeURIComponent(options.code)}&since=${since}`,
          { signal: abortSignal, cache: 'no-store' },
        );
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
  code: string,
  context: AssistantContext,
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<void> {
  try {
    await fetcher('/api/assistant/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'context', code, context }),
      cache: 'no-store',
    });
  } catch {
    // Best effort: the next question carries the context anyway.
  }
}
