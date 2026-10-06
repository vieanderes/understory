import Anthropic, {
  APIError,
  APIUserAbortError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import {
  assistantSystemPrompt,
  plannerPrompt,
  type AssistantErrorCode,
  type AssistantTurn,
} from '@/core/ports/assistant';
import {
  DEFAULT_ASSISTANT_MODEL,
  normaliseTurns,
  type AssistantBody,
  type StreamEvent,
} from '../protocol';

// Replies are meant to be short (the system prompt asks for a sentence or two), but a
// requested snippet of code must not be cut off mid-line.
const MAX_TOKENS = 4096;
// A planned path names up to 200 lessons in JSON, after a sentence or two.
const PLANNER_MAX_TOKENS = 8192;

/**
 * The system prompt as the Messages API takes it. The planner's rules and course are the
 * same for every learner and turn, so they are one cached block, and the learner's part
 * follows it.
 */
export function systemBlocks(
  body: AssistantBody,
  course?: string,
): string | Anthropic.TextBlockParam[] {
  if (body.context.mode !== 'planner') return assistantSystemPrompt(body.context);
  const { stable, learner } = plannerPrompt(body.context, course);
  return [
    { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: learner },
  ];
}

export interface MappedError {
  code: AssistantErrorCode;
  message: string;
  status: number;
}

/** SDK errors in words a candidate can act on. The key never appears in any of them. */
export function mapAnthropicError(error: unknown): MappedError {
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return {
      code: 'unauthorised',
      message: 'Anthropic refused this API key. Check the key in the assistant settings.',
      status: 401,
    };
  }
  if (error instanceof RateLimitError) {
    return {
      code: 'rate-limited',
      message: 'This key has hit its rate limit. Wait a minute, then ask again.',
      status: 429,
    };
  }
  if (error instanceof APIError && (error.status === 529 || error.status === 503)) {
    return {
      code: 'unavailable',
      message: 'Anthropic is overloaded right now. Ask again in a moment.',
      status: 503,
    };
  }
  if (error instanceof APIError && error.status === 400) {
    return {
      code: 'failed',
      message: 'Anthropic could not read the request. Try a shorter question or a new chat.',
      status: 502,
    };
  }
  if (error instanceof APIError && error.status === undefined) {
    return {
      code: 'unavailable',
      message: 'The server could not reach Anthropic. Check the connection and ask again.',
      status: 503,
    };
  }
  return { code: 'failed', message: 'The assistant failed to answer. Ask again.', status: 502 };
}

export interface AnthropicReply {
  events: AsyncIterable<StreamEvent>;
}

/**
 * Opens a streamed reply. Awaiting this throws for errors Anthropic reports before the
 * first token (a bad key, a rate limit); errors after that arrive as an `error` event.
 */
export async function openAnthropicReply(
  apiKey: string,
  body: AssistantBody,
  signal: AbortSignal,
  createClient: (apiKey: string) => Anthropic = (key) =>
    new Anthropic({ apiKey: key, maxRetries: 1 }),
  /** Scout's text of the course, in planner mode. */
  course?: string,
): Promise<AnthropicReply> {
  const client = createClient(apiKey);
  const turns: AssistantTurn[] = normaliseTurns(body.turns);
  const stream = await client.messages.create(
    {
      model: body.model ?? DEFAULT_ASSISTANT_MODEL,
      max_tokens: body.context.mode === 'planner' ? PLANNER_MAX_TOKENS : MAX_TOKENS,
      system: systemBlocks(body, course),
      messages: turns.map((turn) => ({ role: turn.role, content: turn.text })),
      stream: true,
    },
    { signal },
  );

  async function* events(): AsyncGenerator<StreamEvent> {
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text };
        }
      }
      yield { type: 'done' };
    } catch (error) {
      if (error instanceof APIUserAbortError || signal.aborted) return;
      const mapped = mapAnthropicError(error);
      yield { type: 'error', code: mapped.code, message: mapped.message };
    }
  }

  return { events: events() };
}
