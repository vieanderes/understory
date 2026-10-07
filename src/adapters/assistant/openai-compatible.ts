import {
  AssistantError,
  assistantSystemPrompt,
  type AssistantErrorCode,
  type AssistantPort,
  type AssistantRequest,
  type AssistantSignal,
} from '@/core/ports/assistant';
import { normaliseTurns } from './protocol';
import { assistantFetch, errorFromResponse, readNdjson, toAbortSignal } from './stream';

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434/v1';

export interface OpenAiPortOptions {
  getBaseUrl: () => string;
  getKey?: () => string;
  getModel?: () => string;
  fetcher?: typeof fetch;
  /** In planner mode, Scout provides the syllabus text for the system prompt. */
  course?: string;
}

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiChatRequest {
  model: string;
  messages: OpenAiChatMessage[];
  stream: true;
}

/**
 * Normalises user-provided base URLs to point to the chat completions endpoint.
 * Accepts:
 *  - http://localhost:11434 -> http://localhost:11434/v1/chat/completions
 *  - http://localhost:11434/v1 -> http://localhost:11434/v1/chat/completions
 *  - https://api.openai.com/v1 -> https://api.openai.com/v1/chat/completions
 *  - Any URL already ending in /chat/completions is preserved as-is.
 */
export function resolveCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1') || trimmed.includes('/v1/')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

/**
 * Whether the URL points to a local host (Ollama, LM Studio).
 * Localhost requests can be called directly by the browser without touching the Understory server.
 */
export function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(parsed.hostname);
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/.test(url);
  }
}

/**
 * Builds the standard OpenAI chat completions request body.
 */
export function buildOpenAiChatRequest(
  request: AssistantRequest,
  model: string,
  course?: string,
): OpenAiChatRequest {
  const system = assistantSystemPrompt(request.context, course);
  const turns = normaliseTurns(request.turns);
  return {
    model: model.trim() || DEFAULT_OPENAI_MODEL,
    messages: [
      { role: 'system', content: system },
      ...turns.map((turn) => ({ role: turn.role, content: turn.text })),
    ],
    stream: true,
  };
}

export function mapOpenAiStatus(
  status: number,
  message?: string,
): { code: AssistantErrorCode; message: string } {
  if (status === 401 || status === 403) {
    return {
      code: 'unauthorised',
      message: message || 'The provider refused the API key. Check the key in the settings.',
    };
  }
  if (status === 429) {
    return {
      code: 'rate-limited',
      message: message || 'This key has hit its rate limit. Wait a minute, then ask again.',
    };
  }
  if (status === 404 || status === 503 || status === 529) {
    return {
      code: 'unavailable',
      message: message || 'The provider is not available or the model was not found.',
    };
  }
  if (status === 400) {
    return {
      code: 'failed',
      message: message || 'The provider could not read the request. Check the model name.',
    };
  }
  return {
    code: 'failed',
    message: message || 'The assistant failed to answer. Ask again.',
  };
}

interface OpenAiChunk {
  choices?: Array<{
    delta?: { content?: string };
    text?: string;
  }>;
  error?: { message?: string; code?: string };
}

/**
 * Parses Server-Sent Events (SSE) from an OpenAI-compatible /chat/completions stream
 * and yields text deltas in order.
 */
export async function* readOpenAiStream(
  body: ReadableStream<Uint8Array>,
  signal?: AssistantSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  const handle = function* (line: string): Generator<string> {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) return;
    if (!trimmed.startsWith('data:')) return;

    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') {
      done = true;
      return;
    }

    let parsed: OpenAiChunk;
    try {
      parsed = JSON.parse(payload) as OpenAiChunk;
    } catch {
      return;
    }

    if (parsed.error?.message) {
      const mapped = mapOpenAiStatus(400, parsed.error.message);
      throw new AssistantError(mapped.code, mapped.message);
    }

    const first = parsed.choices?.[0];
    const text = first?.delta?.content ?? first?.text;
    if (typeof text === 'string' && text) {
      yield text;
    }
  };

  try {
    while (!done) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        if (signal?.aborted) return;
        throw new AssistantError('failed', 'The reply broke off. Ask again.');
      }
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        yield* handle(line);
        if (done) return;
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (!done && buffer) yield* handle(buffer);
    if (!done && !signal?.aborted) {
      throw new AssistantError('failed', 'The reply broke off. Ask again.');
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * Creates an AssistantPort for OpenAI-compatible backends (Ollama, LM Studio, Groq, Mistral, OpenRouter, OpenAI).
 * When baseUrl is a local URL (e.g. localhost), requests are sent directly from the browser.
 * When baseUrl is remote, requests are proxied via the same-origin /api/assistant/compatible route
 * to avoid browser CORS restrictions and keep keys confidential.
 */
export function createOpenAiCompatiblePort(options: OpenAiPortOptions): AssistantPort {
  const fetcher = options.fetcher ?? ((...args) => fetch(...args));
  return {
    id: 'openai-compatible',
    async *send(request: AssistantRequest, signal?: AssistantSignal) {
      const baseUrl = options.getBaseUrl().trim();
      if (!baseUrl) {
        throw new AssistantError('unavailable', 'Add your OpenAI-compatible base URL first.');
      }
      const model = options.getModel?.().trim() || DEFAULT_OPENAI_MODEL;
      const key = options.getKey?.().trim();

      if (isLocalUrl(baseUrl)) {
        const endpoint = resolveCompletionsUrl(baseUrl);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;

        const payload = buildOpenAiChatRequest(request, model, options.course);
        const response = await assistantFetch(fetcher, endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: toAbortSignal(signal),
          cache: 'no-store',
        });
        if (!response) return;
        if (!response.ok) {
          let errorMessage: string | undefined;
          try {
            const body = (await response.json()) as {
              error?: { message?: string };
              message?: string;
            };
            errorMessage = body.error?.message || body.message;
          } catch {
            // Not JSON
          }
          const mapped = mapOpenAiStatus(response.status, errorMessage);
          throw new AssistantError(mapped.code, mapped.message);
        }
        if (!response.body) throw new AssistantError('failed', 'The server sent an empty reply.');
        yield* readOpenAiStream(response.body, signal);
      } else {
        const headers: Record<string, string> = {
          'x-base-url': baseUrl,
        };
        if (key) headers['x-api-key'] = key;

        const response = await assistantFetch(fetcher, '/api/assistant/compatible', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            turns: request.turns,
            context: request.context,
            model,
          }),
          signal: toAbortSignal(signal),
          cache: 'no-store',
        });
        if (!response) return;
        if (!response.ok) throw await errorFromResponse(response);
        if (!response.body) throw new AssistantError('failed', 'The server sent an empty reply.');
        yield* readNdjson(response.body, signal);
      }
    },
  };
}
