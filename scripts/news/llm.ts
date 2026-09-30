import {
  CONCEPT_EXPLANATION_MAX_WORDS,
  KEY_CONCEPTS_MAX,
  KEY_CONCEPTS_MIN,
  RECALL_CARDS_MAX,
  RELATED_LESSONS_MAX,
  WHAT_HAPPENED_MAX_WORDS,
  WHY_IT_MATTERS_MAX_WORDS,
  llmBriefSchema,
  type Interests,
  type LessonIndexEntry,
  type LlmBrief,
  type NewsItem,
} from '@/core/news';
import { politeFetch, type HttpDeps } from './http';

/*
 * The model-written brief. The Messages API is called with `fetch` on purpose: the
 * project adds no dependency for one POST request, and the pipeline stays a plain Node
 * script. The request shape follows the Anthropic API reference (2026-09).
 *
 * Trust boundary: the model sees only the title, the excerpt, the source name, the topics
 * and the lesson index. What comes back is parsed as JSON, checked by `llmBriefSchema` and
 * then by `validateBrief` (in the pipeline). Anything that fails is replaced by the
 * extractive brief for that one item.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** The model id comes from SIGNAL_MODEL. This default matches .env.example. */
export const DEFAULT_MODEL = 'claude-sonnet-5';

/** A full brief is about 250 words, some 600 tokens of JSON. The cap bounds the cost. */
export const MAX_OUTPUT_TOKENS = 1_200;
const TIMEOUT_MS = 60_000;

/** These models always think and reject `thinking: disabled`. */
const ALWAYS_THINKING = /^claude-(fable|mythos)/;

export interface Summariser {
  model: string;
  brief(item: NewsItem): Promise<LlmBrief>;
}

export interface SummariserOptions {
  apiKey: string;
  model: string;
  interests: Interests;
  lessonIndex: readonly LessonIndexEntry[];
}

export function systemPrompt(lessonIndex: readonly LessonIndexEntry[]): string {
  const lessons = lessonIndex.map((lesson) => `${lesson.id}: ${lesson.title}`).join('\n');
  return `You write short briefs for Signal, the news section of a coding-learning app. The one reader is a working software engineer who wants to understand each item without leaving the app.

You are given one news item: its title, the source, the topics it was filed under and, sometimes, a short excerpt the source published. You have not read the article. Work only from what you are given, plus general engineering knowledge for explaining concepts.

Rules
- British English. Plain, complete sentences. No hype, no adjectives of praise, no exclamation marks, no first person, no questions to the reader.
- Never invent a fact about the item: no numbers, names, dates, causes or results that are not in the input. When the input does not settle something the reader would want to know, write "the source does not say".
- No URLs.
- whatHappened: at most ${WHAT_HAPPENED_MAX_WORDS} words. What the item reports, as far as the title and excerpt show.
- whyItMatters: at most ${WHY_IT_MATTERS_MAX_WORDS} words. The practical consequence for someone who builds web, AI or data systems.
- keyConcepts: ${KEY_CONCEPTS_MIN} to ${KEY_CONCEPTS_MAX} concepts the reader needs to follow the item. Each explanation is at most ${CONCEPT_EXPLANATION_MAX_WORDS} words and defines the concept in general. It is not a claim about the item.
- relatedLessons: up to ${RELATED_LESSONS_MAX} lesson ids from the list below that teach a concept the item depends on. Use only ids from the list. An empty list is fine.
- recallCards: up to ${RECALL_CARDS_MAX} question and answer pairs that test a key concept, not a detail of the news. The question must need a produced answer, not yes or no. An empty list is fine.
- readingLevel: "deep" for a paper or a long technical analysis, otherwise "quick".

Lessons (id: title)
${lessons}`;
}

export function userPrompt(item: NewsItem, interests: Interests): string {
  const topics = item.topics.map(
    (id) => interests.topics.find((topic) => topic.id === id)?.label ?? id,
  );
  return JSON.stringify(
    {
      title: item.title,
      source: item.source.name,
      sourceKind: item.source.kind,
      topics,
      excerpt: item.excerpt ?? null,
    },
    null,
    2,
  );
}

/**
 * The response format. Structured outputs accept no length limits in the schema, so the
 * word limits live in the prompt and are enforced afterwards by zod and `validateBrief`.
 */
export function briefJsonSchema(lessonIndex: readonly LessonIndexEntry[]): Record<string, unknown> {
  const text = { type: 'string' };
  const lessonId =
    lessonIndex.length > 0
      ? { type: 'string', enum: lessonIndex.map((lesson) => lesson.id) }
      : text;
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'whatHappened',
      'whyItMatters',
      'keyConcepts',
      'relatedLessons',
      'recallCards',
      'readingLevel',
    ],
    properties: {
      whatHappened: text,
      whyItMatters: text,
      keyConcepts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['term', 'explanation'],
          properties: { term: text, explanation: text },
        },
      },
      relatedLessons: { type: 'array', items: lessonId },
      recallCards: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['front', 'back'],
          properties: { front: text, back: text },
        },
      },
      readingLevel: { type: 'string', enum: ['quick', 'deep'] },
    },
  };
}

export function requestBody(item: NewsItem, options: SummariserOptions): Record<string, unknown> {
  return {
    model: options.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // A 250-word summary needs no reasoning budget, and thinking tokens would count
    // against max_tokens.
    ...(!ALWAYS_THINKING.test(options.model) && { thinking: { type: 'disabled' } }),
    // The system prompt is the same for every item of a run, so it is marked cacheable.
    system: [
      {
        type: 'text',
        text: systemPrompt(options.lessonIndex),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt(item, options.interests) }],
    output_config: {
      format: { type: 'json_schema', schema: briefJsonSchema(options.lessonIndex) },
    },
  };
}

interface MessagesResponse {
  stop_reason?: unknown;
  content?: unknown;
}

function firstText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content as unknown[]) {
    if (typeof block === 'object' && block !== null && 'type' in block && 'text' in block) {
      if (block.type === 'text' && typeof block.text === 'string') return block.text;
    }
  }
  return null;
}

/** Throws on anything unexpected. The caller turns every throw into the extractive brief. */
export function parseBriefResponse(body: string): LlmBrief {
  const response = JSON.parse(body) as MessagesResponse;
  // `refusal` and `max_tokens` both mean the JSON may be cut off or missing.
  if (response.stop_reason !== 'end_turn') {
    throw new Error(`The model stopped with "${String(response.stop_reason)}".`);
  }
  const text = firstText(response.content);
  if (text === null) throw new Error('The response holds no text block.');
  const parsed = llmBriefSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`The brief fails the schema at ${issue?.path.join('.')}: ${issue?.message}`);
  }
  const { recallCards, ...rest } = parsed.data;
  // The schema asks the model for an array every time. Stored briefs omit an empty one.
  return recallCards !== undefined && recallCards.length > 0 ? { ...rest, recallCards } : rest;
}

export function createAnthropicSummariser(deps: HttpDeps, options: SummariserOptions): Summariser {
  return {
    model: options.model,
    async brief(item) {
      const body = await politeFetch(deps, API_URL, {
        timeoutMs: TIMEOUT_MS,
        accept: 'application/json',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': API_VERSION,
          },
          body: JSON.stringify(requestBody(item, options)),
        },
      });
      return parseBriefResponse(body);
    },
  };
}
