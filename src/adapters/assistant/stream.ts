import {
  AssistantError,
  type AssistantErrorCode,
  type AssistantSignal,
} from '@/core/ports/assistant';
import type { StreamEvent } from './protocol';

/*
 * The browser's half of the wire format in protocol.ts: HTTP errors and NDJSON events
 * turned into text chunks or an AssistantError the panel can show as it is.
 */

const CODES = new Set<AssistantErrorCode>([
  'unauthorised',
  'unavailable',
  'rate-limited',
  'failed',
]);

function statusCode(status: number): AssistantErrorCode {
  if (status === 401 || status === 403) return 'unauthorised';
  if (status === 429) return 'rate-limited';
  if (status === 404 || status === 503) return 'unavailable';
  return 'failed';
}

const STATUS_MESSAGE: Record<AssistantErrorCode, string> = {
  unauthorised: 'The assistant refused the credentials.',
  'rate-limited': 'Too many requests. Wait a minute, then ask again.',
  unavailable: 'The assistant is not available here.',
  failed: 'The assistant failed to answer. Ask again.',
};

/** An error response as an AssistantError, using the server's words when it sent some. */
export async function errorFromResponse(response: Response): Promise<AssistantError> {
  let code = statusCode(response.status);
  let message = STATUS_MESSAGE[code];
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    if (body.error?.code && CODES.has(body.error.code as AssistantErrorCode)) {
      code = body.error.code as AssistantErrorCode;
    }
    if (typeof body.error?.message === 'string' && body.error.message) message = body.error.message;
  } catch {
    // Not JSON (a proxy's error page): the status alone says enough.
  }
  return new AssistantError(code, message);
}

/** fetch, with network failures and aborts turned into the port's terms. */
export async function assistantFetch(
  fetcher: typeof fetch,
  input: string,
  init: RequestInit,
): Promise<Response | undefined> {
  try {
    return await fetcher(input, init);
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return undefined;
    throw new AssistantError('unavailable', 'Could not reach the server. Check the connection.');
  }
}

/** An AssistantSignal as an AbortSignal fetch accepts. */
export function toAbortSignal(signal?: AssistantSignal): AbortSignal | undefined {
  if (!signal) return undefined;
  if (typeof AbortSignal !== 'undefined' && signal instanceof AbortSignal) return signal;
  const controller = new AbortController();
  if (signal.aborted) controller.abort();
  signal.addEventListener?.('abort', () => controller.abort(), { once: true });
  return controller.signal;
}

function parseLine(line: string): StreamEvent | undefined {
  try {
    const event = JSON.parse(line) as StreamEvent;
    return typeof event === 'object' && event !== null && 'type' in event ? event : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Yields the text of an NDJSON reply as it arrives. Throws on an `error` event, and when
 * the stream ends without `done` (the connection dropped mid-reply) unless it was aborted.
 */
export async function* readNdjson(
  body: ReadableStream<Uint8Array>,
  signal?: AssistantSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  const handle = function* (line: string): Generator<string> {
    if (!line.trim()) return;
    const event = parseLine(line);
    if (!event) return;
    if (event.type === 'text') yield event.text;
    else if (event.type === 'done') done = true;
    else if (event.type === 'error') {
      const code = CODES.has(event.code) ? event.code : 'failed';
      throw new AssistantError(code, event.message || STATUS_MESSAGE[code]);
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
