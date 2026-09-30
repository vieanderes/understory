import {
  AssistantError,
  type AssistantPort,
  type AssistantRequest,
  type AssistantSignal,
} from '@/core/ports/assistant';
import { KEY_HEADER, type AssistantModel } from './protocol';
import { assistantFetch, errorFromResponse, readNdjson, toAbortSignal } from './stream';

/*
 * The two providers that stream from a same-origin route: the candidate's API key
 * (/api/assistant) and the Claude account on this machine (/api/assistant/local).
 */

interface StreamingOptions {
  fetcher?: typeof fetch;
  model?: () => AssistantModel | undefined;
}

async function* streamFrom(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AssistantSignal,
): AsyncGenerator<string> {
  const response = await assistantFetch(fetcher, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: toAbortSignal(signal),
    cache: 'no-store',
  });
  if (!response) return;
  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) throw new AssistantError('failed', 'The server sent an empty reply.');
  yield* readNdjson(response.body, signal);
}

export interface ApiKeyPortOptions extends StreamingOptions {
  /** Read on every send, so a key typed after the port was made is used. */
  getKey: () => string;
}

export function createApiKeyPort(options: ApiKeyPortOptions): AssistantPort {
  const fetcher = options.fetcher ?? ((...args) => fetch(...args));
  return {
    id: 'api-key',
    async *send(request: AssistantRequest, signal?: AssistantSignal) {
      const key = options.getKey().trim();
      if (!key) {
        throw new AssistantError('unauthorised', 'Add your Anthropic API key first.');
      }
      yield* streamFrom(
        fetcher,
        '/api/assistant',
        { [KEY_HEADER]: key },
        { turns: request.turns, context: request.context, model: options.model?.() },
        signal,
      );
    },
  };
}

export function createLocalCliPort(options: StreamingOptions = {}): AssistantPort {
  const fetcher = options.fetcher ?? ((...args) => fetch(...args));
  return {
    id: 'claude-cli',
    async *send(request: AssistantRequest, signal?: AssistantSignal) {
      try {
        yield* streamFrom(
          fetcher,
          '/api/assistant/local',
          {},
          { turns: request.turns, context: request.context, model: options.model?.() },
          signal,
        );
      } catch (error) {
        // The route hides itself with a 404 away from localhost.
        if (error instanceof AssistantError && error.code === 'unavailable') {
          throw new AssistantError(
            'unavailable',
            error.message === 'The assistant is not available here.'
              ? 'Your Claude account works only when the app runs on your machine.'
              : error.message,
          );
        }
        throw error;
      }
    },
  };
}

/** Whether the local CLI provider can be offered: the route exists and `claude` runs. */
export async function localCliAvailable(fetcher: typeof fetch = (...args) => fetch(...args)) {
  try {
    const response = await fetcher('/api/assistant/local', { cache: 'no-store' });
    if (!response.ok) return false;
    const body = (await response.json()) as { available?: unknown };
    return body.available === true;
  } catch {
    return false;
  }
}
