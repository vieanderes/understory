import * as z from '@/core/zod';
import { wordCount } from './text';

/*
 * The Signal contract. One source of truth for:
 *  - what a source adapter may hand to the pipeline (RawItem)
 *  - what is written to data/news and rendered by the app (NewsItem, NewsDay, NewsDigest)
 *  - what the language model must return (Brief), checked before anything is stored
 *
 * Legal stance, encoded here: an item holds a title, links, our own summary and at most
 * EXCERPT_MAX_CHARS of the description the source itself published. There is no field
 * that could hold an article body.
 *
 * Objects are strict and optional fields are omitted, never null, so the JSON stays
 * portable to the Swift Codable types.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const EXCERPT_MAX_CHARS = 280;
export const WHAT_HAPPENED_MAX_WORDS = 60;
export const WHY_IT_MATTERS_MAX_WORDS = 50;
export const CONCEPT_EXPLANATION_MAX_WORDS = 30;
export const KEY_CONCEPTS_MIN = 2;
export const KEY_CONCEPTS_MAX = 4;
export const RELATED_LESSONS_MAX = 3;
export const RECALL_CARDS_MAX = 2;
/** A re-run merges into the stored day. The cap keeps a busy day from growing without end. */
export const DAY_ITEMS_HARD_CAP = 24;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const text = (hint: string) => z.string().trim().min(1, hint);

const maxWords = (limit: number, field: string) =>
  text(`${field} must not be empty.`).refine((value) => wordCount(value) <= limit, {
    message: `${field} must be at most ${limit} words.`,
  });

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'A date is written YYYY-MM-DD.');

export const isoInstantSchema = z.iso.datetime({ offset: true });

const httpUrlSchema = z.string().regex(/^https?:\/\/[^\s/?#]+[^\s]*$/i, 'An absolute http(s) URL.');

export const sourceKindSchema = z.enum(['hn', 'arxiv', 'feed']);

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'An id is lowercase words joined by hyphens.');

/** Same shape as the lesson ids in src/core/content/schema.ts: `db.isolation-levels`. */
const lessonIdSchema = z.string().regex(/^[a-z][a-z0-9]*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/);

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** What a source adapter yields. Untrusted: `normalise` cleans it. */
export const rawItemSchema = z.strictObject({
  sourceId: slugSchema,
  sourceName: text('The human name of the source.'),
  kind: sourceKindSchema,
  url: z.string(),
  title: z.string(),
  publishedAt: z.string().optional(),
  authors: z.array(z.string()).optional(),
  points: z.number().optional(),
  comments: z.number().optional(),
  discussionUrl: z.string().optional(),
  /** The description the source published. May hold HTML. Capped by `normalise`. */
  description: z.string().optional(),
  /** Topics the feed list assigns to everything from this source. */
  topicHints: z.array(z.string()).optional(),
});

export const keyConceptSchema = z.strictObject({
  term: text('The concept name.').max(60),
  explanation: maxWords(CONCEPT_EXPLANATION_MAX_WORDS, 'A concept explanation'),
});

export const recallCardSchema = z.strictObject({
  front: text('A question that needs a produced answer.').max(200),
  back: text('The answer.').max(300),
});

export const briefSchema = z.strictObject({
  whatHappened: maxWords(WHAT_HAPPENED_MAX_WORDS, 'whatHappened'),
  whyItMatters: maxWords(WHY_IT_MATTERS_MAX_WORDS, 'whyItMatters'),
  keyConcepts: z.array(keyConceptSchema).min(KEY_CONCEPTS_MIN).max(KEY_CONCEPTS_MAX),
  relatedLessons: z.array(lessonIdSchema).max(RELATED_LESSONS_MAX),
  recallCards: z.array(recallCardSchema).max(RECALL_CARDS_MAX).optional(),
  readingLevel: z.enum(['quick', 'deep']),
  /** Shown in the UI: every brief is labelled by how it was made. */
  generatedBy: z.enum(['llm', 'extractive']),
  model: z.string().min(1).optional(),
});

/** The part of a brief the model writes. Provenance is added by the pipeline, not the model. */
export const llmBriefSchema = briefSchema.omit({ generatedBy: true, model: true });

export const newsSourceSchema = z.strictObject({
  id: slugSchema,
  name: text('The human name of the source.'),
  kind: sourceKindSchema,
});

export const newsItemSchema = z.strictObject({
  id: z.string().regex(/^[0-9a-f]{16}$/, 'An item id is the 16-digit hex hash of its URL.'),
  url: httpUrlSchema,
  canonicalUrl: httpUrlSchema,
  title: text('The headline as the source wrote it.').max(300),
  source: newsSourceSchema,
  publishedAt: isoInstantSchema,
  fetchedAt: isoInstantSchema,
  authors: z.array(text('An author name.')).max(8).optional(),
  points: z.int().min(0).optional(),
  comments: z.int().min(0).optional(),
  discussionUrl: httpUrlSchema.optional(),
  topics: z.array(slugSchema),
  score: z.number().min(0),
  excerpt: z.string().min(1).max(EXCERPT_MAX_CHARS).optional(),
  brief: briefSchema.optional(),
});

// ---------------------------------------------------------------------------
// Day and digest
// ---------------------------------------------------------------------------

export const sourceReportSchema = z.strictObject({
  id: slugSchema,
  ok: z.boolean(),
  count: z.int().min(0),
  error: z.string().optional(),
});

export const dayStatsSchema = z.strictObject({
  fetched: z.int().min(0),
  afterDedupe: z.int().min(0),
  excluded: z.int().min(0),
  selected: z.int().min(0),
  llmBriefs: z.int().min(0),
  extractiveBriefs: z.int().min(0),
  sources: z.array(sourceReportSchema),
});

export const newsDaySchema = z.strictObject({
  date: isoDateSchema,
  generatedAt: isoInstantSchema,
  items: z.array(newsItemSchema).max(DAY_ITEMS_HARD_CAP),
  stats: dayStatsSchema,
});

export const digestPeriodSchema = z.enum(['week', 'month']);

export const topicCountSchema = z.strictObject({ topic: slugSchema, count: z.int().min(1) });

/** A topic that came back on several days of the period: the thread worth following. */
export const threadSchema = z.strictObject({
  topic: slugSchema,
  days: z.int().min(2),
  itemIds: z.array(z.string()).min(2),
});

export const newsDigestSchema = z.strictObject({
  period: digestPeriodSchema,
  /** `2026-W38` for a week, `2026-09` for a month. */
  key: z.string().regex(/^\d{4}-(W(0[1-9]|[1-4]\d|5[0-3])|(0[1-9]|1[0-2]))$/),
  from: isoDateSchema,
  to: isoDateSchema,
  generatedAt: isoInstantSchema,
  days: z.array(isoDateSchema),
  itemCount: z.int().min(0),
  topItems: z.array(newsItemSchema),
  topicCounts: z.array(topicCountSchema),
  threads: z.array(threadSchema),
});

// ---------------------------------------------------------------------------
// Reader profile (content/interests.yaml) and the lesson index
// ---------------------------------------------------------------------------

export const topicSchema = z.strictObject({
  id: slugSchema,
  label: text('The topic name shown in the UI.'),
  weight: z.number().min(0).max(1),
  keywords: z.array(text('A keyword or phrase.')).min(1),
  /** The template sentence the extractive brief uses for "why it matters". */
  why: maxWords(WHY_IT_MATTERS_MAX_WORDS, 'A topic why sentence'),
});

export const glossaryEntrySchema = z.strictObject({
  term: text('The concept name.').max(60),
  /** Phrases that signal the concept. The term itself always counts. */
  match: z.array(text('A phrase.')).default([]),
  explanation: maxWords(CONCEPT_EXPLANATION_MAX_WORDS, 'A glossary explanation'),
  /** Topics this concept belongs to. Used to fill a brief when the text names no concept. */
  topics: z.array(slugSchema).min(1),
});

export const lessonIndexEntrySchema = z.strictObject({
  id: lessonIdSchema,
  title: text('The lesson title.'),
  keywords: z.array(text('A keyword or phrase.')).min(1),
});

export const interestsSchema = z
  .strictObject({
    halfLifeHours: z.number().positive(),
    /** Items scoring below this never reach the day, however quiet the day is. */
    minScore: z.number().min(0).default(0),
    weights: z.strictObject({
      topic: z.number().min(0),
      source: z.number().min(0),
      engagement: z.number().min(0),
      recency: z.number().min(0),
    }),
    /** Trust in a source, 0 to 1. Keys are source ids, with a default per kind. */
    sourceWeights: z.strictObject({
      kinds: z.strictObject({
        hn: z.number().min(0).max(1),
        arxiv: z.number().min(0).max(1),
        feed: z.number().min(0).max(1),
      }),
      ids: z.record(z.string(), z.number().min(0).max(1)).default({}),
    }),
    blocked: z.strictObject({
      terms: z.array(text('A blocked phrase.')).default([]),
      domains: z.array(text('A blocked domain.')).default([]),
    }),
    topics: z.array(topicSchema).min(1),
    glossary: z.array(glossaryEntrySchema),
    lessons: z.array(lessonIndexEntrySchema).default([]),
  })
  .superRefine((interests, ctx) => {
    // The extractive brief promises at least KEY_CONCEPTS_MIN concepts. It can only keep
    // that promise if every topic has that many glossary entries to fall back on.
    const topicIds = new Set(interests.topics.map((topic) => topic.id));
    for (const topic of interests.topics) {
      const entries = interests.glossary.filter((entry) => entry.topics.includes(topic.id));
      if (entries.length < KEY_CONCEPTS_MIN) {
        ctx.addIssue({
          code: 'custom',
          message: `Topic "${topic.id}" needs at least ${KEY_CONCEPTS_MIN} glossary entries.`,
          path: ['glossary'],
        });
      }
    }
    interests.glossary.forEach((entry, index) => {
      for (const topic of entry.topics) {
        if (!topicIds.has(topic)) {
          ctx.addIssue({
            code: 'custom',
            message: `Glossary entry "${entry.term}" names the unknown topic "${topic}".`,
            path: ['glossary', index, 'topics'],
          });
        }
      }
    });
  });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IsoDate = z.infer<typeof isoDateSchema>;
export type SourceKind = z.infer<typeof sourceKindSchema>;
export type RawItem = z.infer<typeof rawItemSchema>;
export type KeyConcept = z.infer<typeof keyConceptSchema>;
export type RecallCard = z.infer<typeof recallCardSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type LlmBrief = z.infer<typeof llmBriefSchema>;
export type NewsSource = z.infer<typeof newsSourceSchema>;
export type NewsItem = z.infer<typeof newsItemSchema>;
export type SourceReport = z.infer<typeof sourceReportSchema>;
export type DayStats = z.infer<typeof dayStatsSchema>;
export type NewsDay = z.infer<typeof newsDaySchema>;
export type DigestPeriod = z.infer<typeof digestPeriodSchema>;
export type TopicCount = z.infer<typeof topicCountSchema>;
export type Thread = z.infer<typeof threadSchema>;
export type NewsDigest = z.infer<typeof newsDigestSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type LessonIndexEntry = z.infer<typeof lessonIndexEntrySchema>;
export type Interests = z.infer<typeof interestsSchema>;
