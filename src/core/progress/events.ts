import { z } from 'zod';
import { idSchema, localIdSchema } from '@/core/content/ids';
import { cardStateSchema, ratingSchema } from '@/core/scheduling/card-state';
import { INTERESTS } from '@/core/profile/interests';
import type { Clock } from '@/core/ports/clock';
import type { IdGen } from '@/core/ports/id-gen';

/*
 * The append-only event log (docs/ARCHITECTURE.md "Event envelope",
 * docs/SYNC-PROTOCOL.md). Events record facts only: XP, rank, mastery and the weekly
 * run are derived by the reducer and never stored, so a sync merge cannot
 * double-count (LEARNING-SCIENCE.md, law 3 in AGENTS.md).
 *
 * Every object is strict and every discriminant is `type`, matching the content
 * schema's conventions, so a typo is a validation error, not a silent no-op.
 * Optional fields are omitted, never null (docs/SYNC-PROTOCOL.md "JSON rules").
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** A module id is one lowercase word, matching `moduleSchema.id` in content/schema.ts. */
export const moduleIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, 'A module id is one lowercase word, for example "js".');

/** `YYYY-MM-DD` in the learner's own zone, so the weekly goal needs no server clock. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "localDate is YYYY-MM-DD in the learner's zone.");

export const deviceIdSchema = z.string().min(1);
export const contentRevSchema = z.string().min(1);

/** The three-level confidence control on every scored step (LEARNING-SCIENCE.md, principle 10). */
export const confidenceSchema = z.enum(['guess', 'fairly', 'certain']);
export type Confidence = z.infer<typeof confidenceSchema>;

/** Step types that produce a `step_answered` event. Prose earns nothing and has no
 * answer; explain-back has its own event because it carries a rubric self-grade. */
export const answeredStepTypeSchema = z.enum([
  'predict-output',
  'multiple-choice',
  'trace-table',
  'fill-blank',
  'parsons',
  'bug-hunt',
  'ai-review',
  'code-challenge',
  'lab',
  'incident',
  'playground',
  'sql',
]);
export type AnsweredStepType = z.infer<typeof answeredStepTypeSchema>;

export const modeSchema = z.enum(['guided', 'challenge-first']);
export type Mode = z.infer<typeof modeSchema>;

export const sessionKindSchema = z.enum(['practice', 'lesson']);
export const deviceKindSchema = z.enum(['phone', 'desktop']);
export const sessionMinutesSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(20),
  z.literal(45),
]);

// ---------------------------------------------------------------------------
// Payload schemas
// ---------------------------------------------------------------------------

export const placementAnsweredPayloadSchema = z.strictObject({
  itemId: z.string().min(1),
  moduleId: moduleIdSchema,
  rung: z.int().min(1),
  correct: z.boolean(),
  confidence: confidenceSchema,
});

export const placementCompletedPayloadSchema = z.strictObject({
  startedAs: z.enum(['new', 'ai-builder', 'experienced']),
  thetaByModule: z.record(moduleIdSchema, z.number()),
  assumedConcepts: z.array(idSchema),
});

export const stepAnsweredPayloadSchema = z.strictObject({
  lessonId: idSchema,
  stepId: localIdSchema,
  stepType: answeredStepTypeSchema,
  concept: idSchema,
  difficulty: z.int().min(1).max(5),
  tryNumber: z.int().min(1),
  hintsUsed: z.int().min(0),
  revealed: z.boolean(),
  score: z.number().min(0).max(1),
  correct: z.boolean(),
  confidence: confidenceSchema.optional(),
  mode: modeSchema,
  context: z.enum(['lesson', 'practice', 'test-out', 'probe']),
  durationMs: z.int().min(0).optional(),
});

/** `"lesson:<lessonId>#<cardId>"` for a fact card, `"skill:<lessonId>#<stepId>"` for a
 * skill item. Both kinds of FSRS item run on the same scheduler (LEARNING-SCIENCE B4). */
export const cardKeySchema = z
  .string()
  .regex(
    /^(lesson|skill):[a-z][a-z0-9.-]*#[a-z0-9-]+$/,
    'A cardKey is "lesson:<id>#<id>" or "skill:<id>#<id>".',
  );

export const reviewGradedPayloadSchema = z.strictObject({
  cardKey: cardKeySchema,
  concept: idSchema,
  rating: ratingSchema,
  retrievabilityBefore: z.number().min(0).max(1).optional(),
  state: cardStateSchema,
});

export const lessonCompletedPayloadSchema = z.strictObject({
  lessonId: idSchema,
});

export const explainBackGradedPayloadSchema = z.strictObject({
  lessonId: idSchema,
  stepId: localIdSchema,
  concept: idSchema,
  rubricHits: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().optional(),
});

export const capstoneCompletedPayloadSchema = z.strictObject({
  moduleId: moduleIdSchema,
});

/** The longest ADR title and section, in UTF-16 code units as JavaScript counts them.
 * A record is a page, not an essay, and the cap keeps a synced log small. */
export const ADR_TITLE_MAX = 120;
export const ADR_SECTION_MAX = 4000;

/** Text with at least one visible character. A blank optional section is omitted. */
const adrText = (max: number) =>
  z.string().max(max).regex(/\S/, 'Write something, or leave the field out.');

/**
 * An architecture decision record for a part's capstone, after Nygard's "Documenting
 * Architecture Decisions" (2011: title, context, decision, consequences) with MADR's
 * "Considered Options" as alternatives. It is its own event, not a field on
 * `capstone_completed`: an older client reads an unknown type as unknown and ignores it,
 * but would read a changed `capstone_completed` as unknown too and lose the capstone.
 * A later event for the same part replaces the record; the earlier ones stay in the log.
 */
export const capstoneAdrWrittenPayloadSchema = z.strictObject({
  partId: moduleIdSchema,
  title: adrText(ADR_TITLE_MAX),
  context: adrText(ADR_SECTION_MAX).optional(),
  decision: adrText(ADR_SECTION_MAX),
  alternatives: adrText(ADR_SECTION_MAX).optional(),
  consequences: adrText(ADR_SECTION_MAX).optional(),
});

export const incidentResolvedPayloadSchema = z.strictObject({
  incidentId: z.string().min(1),
  concept: idSchema,
  score: z.number().min(0).max(1),
});

export const testOutAttemptedPayloadSchema = z.strictObject({
  moduleId: moduleIdSchema,
  score: z.number().min(0).max(1),
  passed: z.boolean(),
});

/** A path is a track id: lowercase words joined by hyphens, for example "coding-rounds". */
export const pathIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'A path id is lowercase words joined by hyphens.');

/**
 * One sitting of a path's final exam, as facts: which path, which lessons it covered,
 * the seed that rebuilds its questions, how many of how many were right, and when. Whether
 * it passed, the best score and the certificate are derived (src/core/exam), never stored,
 * so the pass mark can be read the same way on every device.
 */
export const pathExamAttemptedPayloadSchema = z
  .strictObject({
    pathId: pathIdSchema,
    seed: z.number(),
    right: z.int().min(0),
    total: z.int().min(1),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
    lessonIds: z.array(idSchema),
  })
  .refine((p) => p.right <= p.total, 'right cannot exceed total.')
  .refine((p) => p.startedAt <= p.finishedAt, 'An exam finishes after it starts.');

const tallySchema = z.strictObject({ passed: z.int().min(0), total: z.int().min(0) });

/**
 * One sitting of the online-test simulator (docs/ONLINE-TEST.md): the facts of each task's
 * scoring, as tallies of tests passed. Percentages and the total are derived
 * (src/core/online-test/score.ts), never stored.
 */
export const onlineTestSubmittedPayloadSchema = z
  .strictObject({
    attemptId: z.string().min(1).max(64),
    testKey: z.string().min(1).max(120),
    title: z.string().min(1).max(120),
    mode: z.enum(['demo', 'screen', 'ai', 'mock', 'training', 'custom']),
    minutes: z.int().min(1).max(240),
    startedAt: z.iso.datetime(),
    submittedAt: z.iso.datetime(),
    reason: z.enum(['candidate', 'time-up']),
    tasks: z
      .array(
        z.strictObject({
          taskId: z.string().min(1).max(80),
          language: z.enum(['js', 'ts', 'python']),
          type: z.enum(['algorithmic', 'coding', 'bug-fix']),
          correctness: tallySchema,
          performance: tallySchema,
          zeroedBy: z.enum(['compile', 'no-change', 'too-many-changes']).optional(),
          complexity: z.string().max(40).optional(),
        }),
      )
      .min(1)
      .max(8),
    assistantPrompts: z.int().min(0),
    /** The guide walked the candidate through: a rehearsal, not a measurement. */
    guided: z.boolean().optional(),
  })
  .refine((p) => p.startedAt <= p.submittedAt, 'A test is submitted after it starts.');

/**
 * The learner's plan (src/core/plan): their answers, as a fact. The phases, the next step
 * and the pace are derived from these and the catalogue, never stored. A new plan_set
 * replaces the plan; plan_cleared drops it. Both stay in the log as history.
 */
export const planSetPayloadSchema = z
  .strictObject({
    goal: z.enum([
      'from-zero',
      'refresh',
      'second-language',
      'builder',
      'ai-engineer',
      'interviews',
      'senior',
      'stay-sharp',
    ]),
    level: z.enum(['new', 'some', 'pro']),
    language: z.enum(['js', 'python']),
    minutesPerWeek: z.int().min(15).max(3000),
    deadline: z.iso.date().optional(),
    since: z.iso.date(),
  })
  .refine(
    (p) => p.deadline === undefined || p.deadline >= p.since,
    'A deadline comes after the plan starts.',
  );

export const planClearedPayloadSchema = z.strictObject({});

/**
 * What the learner said they care about, from the setup questions or Settings. The latest
 * profile_set wins. Interests order practice topics and the news; they never hide content.
 */
export const profileSetPayloadSchema = z.strictObject({
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
  /** Show today's news on Home. */
  news: z.boolean(),
});

/**
 * The lessons of a path the learner built themselves, in any order; the path shows them in
 * course order. An empty list removes it.
 */
export const customPathSetPayloadSchema = z.strictObject({
  lessonIds: z.array(idSchema).max(1000),
});

/** A news edition was opened. Read state is a fact, so it follows the progress file. */
export const newsReadPayloadSchema = z.strictObject({
  date: z.iso.date(),
});

export const sessionStartedPayloadSchema = z.strictObject({
  sessionId: z.string().min(1),
  kind: sessionKindSchema,
  minutes: sessionMinutesSchema,
  device: deviceKindSchema,
  seed: z.number(),
});

export const sessionFinishedPayloadSchema = z.strictObject({
  sessionId: z.string().min(1),
  /** Count of items completed. Per-item facts already exist as their own events
   * (step_answered, review_graded, ...), so this is a summary count, not a list
   * (simplest reading; recorded in docs/LEARNING-SCIENCE.md Implementation notes). */
  items: z.int().min(0),
});

export const goalTierSetPayloadSchema = z.strictObject({
  tier: z.enum(['light', 'steady', 'deep']),
});

export const modeSetPayloadSchema = z.strictObject({
  moduleId: moduleIdSchema,
  mode: modeSchema,
});

/** Last writer wins per key (docs/ARCHITECTURE.md "Settings"). */
export const settingChangedPayloadSchema = z.strictObject({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const aiHoursReportedPayloadSchema = z.strictObject({
  isoWeek: z.string().regex(/^\d{4}-W\d{2}$/, 'isoWeek is "YYYY-Www".'),
  withAi: z.number().min(0),
  withoutAi: z.number().min(0),
});

export const readingCollectedPayloadSchema = z.strictObject({
  referenceKey: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

function envelope<Type extends string, Payload extends z.ZodTypeAny>(
  type: Type,
  v: number,
  payload: Payload,
) {
  return z.strictObject({
    id: z.uuid({ version: 'v7' }),
    type: z.literal(type),
    v: z.literal(v),
    at: z.iso.datetime(),
    localDate: localDateSchema,
    deviceId: deviceIdSchema,
    seq: z.int().min(0),
    contentRev: contentRevSchema,
    payload,
  });
}

/** Every event type's current version. A future breaking payload change adds an
 * upcaster (progress/upcast.ts) and bumps the number here; old stored events are
 * never rewritten. */
export const LATEST_VERSION = {
  placement_answered: 1,
  placement_completed: 1,
  step_answered: 1,
  review_graded: 1,
  lesson_completed: 1,
  explain_back_graded: 1,
  capstone_completed: 1,
  capstone_adr_written: 1,
  incident_resolved: 1,
  test_out_attempted: 1,
  session_started: 1,
  session_finished: 1,
  goal_tier_set: 1,
  mode_set: 1,
  setting_changed: 1,
  ai_hours_reported: 1,
  reading_collected: 1,
  path_exam_attempted: 1,
  online_test_submitted: 1,
  plan_set: 1,
  plan_cleared: 1,
  profile_set: 1,
  news_read: 1,
  custom_path_set: 1,
} as const;

export type EventType = keyof typeof LATEST_VERSION;

export const placementAnsweredEventSchema = envelope(
  'placement_answered',
  LATEST_VERSION.placement_answered,
  placementAnsweredPayloadSchema,
);
export const placementCompletedEventSchema = envelope(
  'placement_completed',
  LATEST_VERSION.placement_completed,
  placementCompletedPayloadSchema,
);
export const stepAnsweredEventSchema = envelope(
  'step_answered',
  LATEST_VERSION.step_answered,
  stepAnsweredPayloadSchema,
);
export const reviewGradedEventSchema = envelope(
  'review_graded',
  LATEST_VERSION.review_graded,
  reviewGradedPayloadSchema,
);
export const lessonCompletedEventSchema = envelope(
  'lesson_completed',
  LATEST_VERSION.lesson_completed,
  lessonCompletedPayloadSchema,
);
export const explainBackGradedEventSchema = envelope(
  'explain_back_graded',
  LATEST_VERSION.explain_back_graded,
  explainBackGradedPayloadSchema,
);
export const capstoneCompletedEventSchema = envelope(
  'capstone_completed',
  LATEST_VERSION.capstone_completed,
  capstoneCompletedPayloadSchema,
);
export const capstoneAdrWrittenEventSchema = envelope(
  'capstone_adr_written',
  LATEST_VERSION.capstone_adr_written,
  capstoneAdrWrittenPayloadSchema,
);
export const incidentResolvedEventSchema = envelope(
  'incident_resolved',
  LATEST_VERSION.incident_resolved,
  incidentResolvedPayloadSchema,
);
export const testOutAttemptedEventSchema = envelope(
  'test_out_attempted',
  LATEST_VERSION.test_out_attempted,
  testOutAttemptedPayloadSchema,
);
export const sessionStartedEventSchema = envelope(
  'session_started',
  LATEST_VERSION.session_started,
  sessionStartedPayloadSchema,
);
export const sessionFinishedEventSchema = envelope(
  'session_finished',
  LATEST_VERSION.session_finished,
  sessionFinishedPayloadSchema,
);
export const goalTierSetEventSchema = envelope(
  'goal_tier_set',
  LATEST_VERSION.goal_tier_set,
  goalTierSetPayloadSchema,
);
export const modeSetEventSchema = envelope(
  'mode_set',
  LATEST_VERSION.mode_set,
  modeSetPayloadSchema,
);
export const settingChangedEventSchema = envelope(
  'setting_changed',
  LATEST_VERSION.setting_changed,
  settingChangedPayloadSchema,
);
export const aiHoursReportedEventSchema = envelope(
  'ai_hours_reported',
  LATEST_VERSION.ai_hours_reported,
  aiHoursReportedPayloadSchema,
);
export const readingCollectedEventSchema = envelope(
  'reading_collected',
  LATEST_VERSION.reading_collected,
  readingCollectedPayloadSchema,
);

export const pathExamAttemptedEventSchema = envelope(
  'path_exam_attempted',
  LATEST_VERSION.path_exam_attempted,
  pathExamAttemptedPayloadSchema,
);

export const onlineTestSubmittedEventSchema = envelope(
  'online_test_submitted',
  LATEST_VERSION.online_test_submitted,
  onlineTestSubmittedPayloadSchema,
);

export const planSetEventSchema = envelope(
  'plan_set',
  LATEST_VERSION.plan_set,
  planSetPayloadSchema,
);
export const planClearedEventSchema = envelope(
  'plan_cleared',
  LATEST_VERSION.plan_cleared,
  planClearedPayloadSchema,
);

export const profileSetEventSchema = envelope(
  'profile_set',
  LATEST_VERSION.profile_set,
  profileSetPayloadSchema,
);
export const newsReadEventSchema = envelope(
  'news_read',
  LATEST_VERSION.news_read,
  newsReadPayloadSchema,
);

export const customPathSetEventSchema = envelope(
  'custom_path_set',
  LATEST_VERSION.custom_path_set,
  customPathSetPayloadSchema,
);

export const storyEventSchema = z.discriminatedUnion('type', [
  placementAnsweredEventSchema,
  placementCompletedEventSchema,
  stepAnsweredEventSchema,
  reviewGradedEventSchema,
  lessonCompletedEventSchema,
  explainBackGradedEventSchema,
  capstoneCompletedEventSchema,
  capstoneAdrWrittenEventSchema,
  incidentResolvedEventSchema,
  testOutAttemptedEventSchema,
  sessionStartedEventSchema,
  sessionFinishedEventSchema,
  goalTierSetEventSchema,
  modeSetEventSchema,
  settingChangedEventSchema,
  aiHoursReportedEventSchema,
  readingCollectedEventSchema,
  pathExamAttemptedEventSchema,
  onlineTestSubmittedEventSchema,
  planSetEventSchema,
  planClearedEventSchema,
  profileSetEventSchema,
  newsReadEventSchema,
  customPathSetEventSchema,
]);

export type StoryEvent = z.infer<typeof storyEventSchema>;

export type PayloadOf<T extends EventType> = Extract<StoryEvent, { type: T }>['payload'];

// ---------------------------------------------------------------------------
// makeEvent
// ---------------------------------------------------------------------------

export interface MakeEventDeps {
  readonly clock: Clock;
  readonly ids: IdGen;
  readonly deviceId: string;
  /** Returns this device's next per-device sequence number. */
  readonly nextSeq: () => number;
  readonly contentRev: string;
  readonly localDate: string;
}

/** Builds and validates one envelope. The event's `v` is always the type's latest,
 * because a new event is never written in an old shape. */
export function makeEvent<T extends EventType>(
  deps: MakeEventDeps,
  type: T,
  payload: PayloadOf<T>,
): StoryEvent {
  const candidate = {
    id: deps.ids.next(),
    type,
    v: LATEST_VERSION[type],
    at: deps.clock.now().toISOString(),
    localDate: deps.localDate,
    deviceId: deps.deviceId,
    seq: deps.nextSeq(),
    contentRev: deps.contentRev,
    payload,
  };
  return storyEventSchema.parse(candidate);
}
