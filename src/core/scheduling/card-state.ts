import { z } from 'zod';

/*
 * A plain-JSON mirror of ts-fsrs's `Card`, so it can travel inside a `review_graded`
 * event (docs/ARCHITECTURE.md "Scheduling"). Dates are ISO-8601 UTC strings, never
 * `Date` objects, and the FSRS `State` enum is spelled out lower-case so the JSON is
 * readable without importing ts-fsrs.
 */

export const cardLifecycleStateSchema = z.enum(['new', 'learning', 'review', 'relearning']);
export type CardLifecycleState = z.infer<typeof cardLifecycleStateSchema>;

export const cardStateSchema = z.strictObject({
  due: z.iso.datetime(),
  stability: z.number().min(0),
  difficulty: z.number().min(0).max(10),
  reps: z.int().min(0),
  lapses: z.int().min(0),
  state: cardLifecycleStateSchema,
  scheduledDays: z.int().min(0),
  elapsedDays: z.int().min(0),
  lastReview: z.iso.datetime().optional(),
  learningSteps: z.int().min(0).optional(),
});

export type CardState = z.infer<typeof cardStateSchema>;

/** FSRS ratings, matching ts-fsrs's `Rating` enum values (Again=1 .. Easy=4, no Manual). */
export const ratingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type FsrsRating = z.infer<typeof ratingSchema>;
