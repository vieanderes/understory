import { FORMAT_FAMILY, type FormatFamily } from '@/core/content/family';
import {
  EXPLAIN_BACK_SELF_GRADE_TO_SCORE,
  xpFor,
  xpKindForStepType,
  type CalibrationAnswer,
  type GoalTier,
  type XpInput,
} from '@/core/gamification';
import { scoreTallies } from '@/core/online-test/score';
import { ALPHA_BY_FAMILY, masteryOf, SOLID_THRESHOLD, type ConceptEvidence } from '@/core/mastery';
import type { CardState } from '@/core/scheduling/card-state';
import type { Mode, PayloadOf, StoryEvent } from './events';
import type { UnknownEvent } from './upcast';

/*
 * The pure fold from an event log to a read model (docs/ARCHITECTURE.md "reduce").
 * `reduce` sorts by (at, deviceId, seq) and de-duplicates by id, so the union of two
 * devices' logs gives the same state in any order (docs/SYNC-PROTOCOL.md "Merge is a
 * set union by id").
 */

/** 2: `capstoneAdrs` joined the state. 3: `pathExams`. 4: `onlineTests`. 5: `plan`.
 * 6: `profile`, `newsRead`, `customPath`, and XP for timed tests. 7: `lessonCompletedOn`.
 * 8: `customPath` became `ownPaths`, several named paths. 9: `placementByArea`.
 * 10: `vocabulary`. 11: `milestonesMet`. 12: `confidentMisses`. */
export const REDUCER_VERSION = 12;

const MISSES_PER_LESSON = 5;

/** A wrong answer given with confidence joins its lesson's misses; a right one clears it. */
function noteMiss(
  misses: ProgressState['confidentMisses'],
  answer: { lessonId: string; stepId: string; correct: boolean; confidence?: string | undefined },
): ProgressState['confidentMisses'] {
  const { lessonId, stepId, correct, confidence } = answer;
  const before = misses[lessonId] ?? [];
  const others = before.filter((m) => m.stepId !== stepId);
  if (correct || (confidence !== 'fairly' && confidence !== 'certain')) {
    if (others.length === before.length) return misses;
    return { ...misses, [lessonId]: others };
  }
  const miss = { stepId, confidence } as const;
  return { ...misses, [lessonId]: [...others, miss].slice(-MISSES_PER_LESSON) };
}

/** A day's worth of XP by 24-hour cooldown key, so "no grinding" can be checked. One
 * day of slack either side of midnight is not modelled; a plain 24h window from the
 * last graded `at` is the simplest reading of C's "within 24 hours" rule. */
const GRINDING_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface ConceptRecord {
  readonly p: number;
  readonly familiesPassed: ReadonlySet<FormatFamily>;
  readonly produceOrExplainPassed: boolean;
  /** Local dates (YYYY-MM-DD) on which a correct attempt landed. May repeat. */
  readonly successLocalDates: readonly string[];
  readonly assumed: boolean;
  /** Once mastery has reached Solid (>= 0.7) or Fluent (>= 0.85, a superset), stays
   * true for ever, so the Gap rule can fire later (B4). */
  readonly wasEverSolidOrFluent: boolean;
  readonly attemptCount: number;
}

function emptyConceptRecord(): ConceptRecord {
  return {
    p: 0,
    familiesPassed: new Set(),
    produceOrExplainPassed: false,
    successLocalDates: [],
    assumed: false,
    wasEverSolidOrFluent: false,
    attemptCount: 0,
  };
}

export interface TestOutAttempt {
  readonly score: number;
  readonly passed: boolean;
  readonly at: string;
}

/** One sitting of a path's final exam: the event's facts and the learner's date. */
export interface PathExamAttempt {
  readonly seed: number;
  readonly right: number;
  readonly total: number;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly lessonIds: readonly string[];
  readonly localDate: string;
}

/** One sitting of the online-test simulator: the event's facts and the learner's date. */
export type OnlineTestAttempt = PayloadOf<'online_test_submitted'> & { readonly localDate: string };

/** The current decision record of one part's capstone. */
/** An own path as Learn shows it: the latest `custom_path_set` for its id. */
export type OwnPath = Omit<PayloadOf<'custom_path_set'>, 'pathId'> & { readonly id: string };

/** One speed round of the vocabulary, with the learner's date. */
export type WordRound = PayloadOf<'word_round_finished'> & { readonly localDate: string };

/** The learner's words: the deck, a card per reviewed word, and the speed rounds. */
export interface VocabularyState {
  /** Word id to the learner's date it joined the deck, in the order words joined. */
  readonly deck: ReadonlyMap<string, string>;
  /** Kept when a word leaves the deck, so adding it back resumes its schedule. */
  readonly cards: Readonly<Record<string, CardState>>;
  readonly reviews: number;
  readonly correct: number;
  /** Reviews per learner's date, for "today" and the run of days. */
  readonly reviewedOn: Readonly<Record<string, number>>;
  readonly rounds: readonly WordRound[];
}

export interface CapstoneAdr {
  readonly partId: string;
  readonly title: string;
  readonly context?: string;
  readonly decision: string;
  readonly alternatives?: string;
  readonly consequences?: string;
  /** The learner's date of the first version, and of the one shown. */
  readonly firstWrittenOn: string;
  readonly updatedOn: string;
  /** How many versions the log holds. Every one of them stays there. */
  readonly revisions: number;
}

export interface ProgressState {
  readonly reducerVersion: number;
  readonly concepts: Readonly<Record<string, ConceptRecord>>;
  readonly cards: Readonly<Record<string, CardState>>;
  /** Which concept each card belongs to, from `review_graded.concept`. */
  readonly cardConcept: Readonly<Record<string, string>>;
  readonly thetaByModule: Readonly<Record<string, number>>;
  readonly modeByModule: Readonly<Record<string, Mode>>;
  readonly settings: Readonly<Record<string, string | number | boolean>>;
  readonly goalTier: GoalTier | undefined;
  readonly xpByLocalDate: Readonly<Record<string, number>>;
  readonly calibrationAnswers: readonly CalibrationAnswer[];
  readonly completedLessons: ReadonlySet<string>;
  /** The learner's date of each lesson's first completion, so activity can be told by week. */
  readonly lessonCompletedOn: Readonly<Record<string, string>>;
  readonly completedCapstones: ReadonlySet<string>;
  /** Last writer wins per part, in (at, deviceId, seq) order. */
  readonly capstoneAdrs: Readonly<Record<string, CapstoneAdr>>;
  readonly resolvedIncidents: readonly {
    readonly incidentId: string;
    readonly concept: string;
    readonly score: number;
  }[];
  readonly testOuts: Readonly<Record<string, readonly TestOutAttempt[]>>;
  /** Every final exam sitting per path, in log order. Results are derived in src/core/exam. */
  readonly pathExams: Readonly<Record<string, readonly PathExamAttempt[]>>;
  /** Every online-test sitting, in log order. Scores are derived in src/core/online-test. */
  readonly onlineTests: readonly OnlineTestAttempt[];
  /** The learner's plan answers, the latest plan_set, until a plan_cleared. */
  readonly plan: PayloadOf<'plan_set'> | undefined;
  /** The latest profile_set: interests and whether Home shows the news. */
  readonly profile: PayloadOf<'profile_set'> | undefined;
  /** News editions opened, by date (YYYY-MM-DD). */
  readonly newsRead: ReadonlySet<string>;
  /** The paths the learner made, by id, in the order they were first made. */
  readonly ownPaths: ReadonlyMap<string, OwnPath>;
  /**
   * Per lesson, the steps last answered wrongly while fairly sure or certain, oldest first,
   * at most five: the clearest sign of a misconception, for Scout's Tutor.
   */
  readonly confidentMisses: Readonly<
    Record<string, readonly { stepId: string; confidence: 'fairly' | 'certain' }[]>
  >;
  /** Per own path, the milestones the learner has marked met, by their text. */
  readonly milestonesMet: ReadonlyMap<string, ReadonlySet<string>>;
  readonly assumedConcepts: ReadonlySet<string>;
  /** How many placements were finished. A later one rotates its items. */
  readonly placementsCompleted: number;
  /** The latest placed level per area, 0 to 3, and when. A check of one area updates only it. */
  readonly placementByArea: Readonly<
    Record<string, { readonly level: number; readonly at: string }>
  >;
  readonly collectedReadings: ReadonlySet<string>;
  readonly aiReviewsPassed: number;
  readonly vocabulary: VocabularyState;
  /** Internal bookkeeping for the "same item within 24h" XP rule. Not part of the
   * public read model's meaning, but part of the state so folding stays pure. */
  readonly lastGradedAt: Readonly<Record<string, string>>;
}

export function initialProgressState(): ProgressState {
  return {
    reducerVersion: REDUCER_VERSION,
    concepts: {},
    cards: {},
    cardConcept: {},
    thetaByModule: {},
    modeByModule: {},
    settings: {},
    goalTier: undefined,
    xpByLocalDate: {},
    calibrationAnswers: [],
    completedLessons: new Set(),
    lessonCompletedOn: {},
    completedCapstones: new Set(),
    capstoneAdrs: {},
    resolvedIncidents: [],
    testOuts: {},
    pathExams: {},
    onlineTests: [],
    plan: undefined,
    profile: undefined,
    newsRead: new Set(),
    ownPaths: new Map(),
    milestonesMet: new Map(),
    confidentMisses: {},
    assumedConcepts: new Set(),
    placementsCompleted: 0,
    placementByArea: {},
    collectedReadings: new Set(),
    aiReviewsPassed: 0,
    vocabulary: {
      deck: new Map(),
      cards: {},
      reviews: 0,
      correct: 0,
      reviewedOn: {},
      rounds: [],
    },
    lastGradedAt: {},
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withinCooldown(state: ProgressState, itemKey: string, at: string): boolean {
  const last = state.lastGradedAt[itemKey];
  if (!last) return false;
  return new Date(at).getTime() - new Date(last).getTime() < GRINDING_COOLDOWN_MS;
}

function addXp(
  state: ProgressState,
  localDate: string,
  amount: number,
): Readonly<Record<string, number>> {
  if (amount === 0) return state.xpByLocalDate;
  return { ...state.xpByLocalDate, [localDate]: (state.xpByLocalDate[localDate] ?? 0) + amount };
}

function conceptCards(state: ProgressState, concept: string): CardState[] {
  return Object.entries(state.cardConcept)
    .filter(([, c]) => c === concept)
    .map(([cardKey]) => state.cards[cardKey])
    .filter((card): card is CardState => card !== undefined);
}

/** Recomputes `wasEverSolidOrFluent` for one concept from its current evidence and
 * cards. Cheap enough to call after every event that touches the concept, and keeps
 * the flag in lock-step with the same `masteryOf` formula the rest of the app uses. */
function refreshSolidHistory(state: ProgressState, concept: string, now: Date): ProgressState {
  const record = state.concepts[concept];
  if (!record) return state;
  const evidence: ConceptEvidence = {
    p: record.p,
    familiesPassed: record.familiesPassed,
    produceOrExplainPassed: record.produceOrExplainPassed,
  };
  const mastery = masteryOf(evidence, conceptCards(state, concept), now);
  if (record.wasEverSolidOrFluent || mastery < SOLID_THRESHOLD) return state;
  return {
    ...state,
    concepts: { ...state.concepts, [concept]: { ...record, wasEverSolidOrFluent: true } },
  };
}

/** B4's `s` for a recall-card review, derived from the coarser FSRS rating. There is
 * no separate attempt-score event for a flashcard, so this reuses the explain-back
 * self-grade scale (0, 0.4, 0.7, 1), the closest four-point scale the spec defines
 * (chosen reading, recorded in docs/LEARNING-SCIENCE.md). */
function scoreFromRating(rating: 1 | 2 | 3 | 4): number {
  return EXPLAIN_BACK_SELF_GRADE_TO_SCORE[rating - 1] ?? 0;
}

// ---------------------------------------------------------------------------
// applyEvent
// ---------------------------------------------------------------------------

export function applyEvent(state: ProgressState, event: StoryEvent | UnknownEvent): ProgressState {
  if (event.type === 'unknown') return state;
  const at = new Date(event.at);

  switch (event.type) {
    case 'placement_answered': {
      const answer: CalibrationAnswer = {
        confidence: event.payload.confidence,
        correct: event.payload.correct,
        moduleId: event.payload.moduleId,
      };
      return { ...state, calibrationAnswers: [...state.calibrationAnswers, answer] };
    }

    case 'placement_completed': {
      const assumedConcepts = new Set(state.assumedConcepts);
      const concepts = { ...state.concepts };
      // A later placement that did not show a concept takes back an earlier assumption.
      for (const concept of event.payload.unassumedConcepts) {
        if (!assumedConcepts.delete(concept)) continue;
        const record = concepts[concept];
        if (record) concepts[concept] = { ...record, assumed: false };
      }
      for (const concept of event.payload.assumedConcepts) {
        assumedConcepts.add(concept);
        concepts[concept] = { ...(concepts[concept] ?? emptyConceptRecord()), assumed: true };
      }
      return {
        ...state,
        assumedConcepts,
        concepts,
        placementsCompleted: state.placementsCompleted + 1,
        placementByArea: {
          ...state.placementByArea,
          ...Object.fromEntries(
            Object.entries(event.payload.levelByArea).map(([area, level]) => [
              area,
              { level, at: event.at },
            ]),
          ),
        },
        thetaByModule: { ...state.thetaByModule, ...event.payload.thetaByModule },
      };
    }

    case 'step_answered': {
      const { lessonId, stepId, stepType, concept, score, correct, mode, localDate } = {
        ...event.payload,
        localDate: event.localDate,
      };
      const itemKey = `${lessonId}#${stepId}`;
      const family = FORMAT_FAMILY[stepType];
      const prev = state.concepts[concept] ?? emptyConceptRecord();
      const nextRecord: ConceptRecord = {
        ...prev,
        p: (1 - ALPHA_BY_FAMILY[family]) * prev.p + ALPHA_BY_FAMILY[family] * score,
        familiesPassed: correct ? new Set(prev.familiesPassed).add(family) : prev.familiesPassed,
        produceOrExplainPassed: prev.produceOrExplainPassed || (correct && family === 'produce'),
        successLocalDates: correct
          ? [...prev.successLocalDates, localDate]
          : prev.successLocalDates,
        attemptCount: prev.attemptCount + 1,
      };

      const xpInput: XpInput = {
        kind: xpKindForStepType(stepType),
        score,
        wasScheduled: true,
        challengeFirstWrongAttempt: mode === 'challenge-first' && !correct,
        withinCooldown: withinCooldown(state, itemKey, event.at),
      };
      const xp = xpFor(xpInput);

      let next: ProgressState = {
        ...state,
        confidentMisses: noteMiss(state.confidentMisses, event.payload),
        concepts: { ...state.concepts, [concept]: nextRecord },
        xpByLocalDate: addXp(state, localDate, xp),
        lastGradedAt: { ...state.lastGradedAt, [itemKey]: event.at },
        aiReviewsPassed: state.aiReviewsPassed + (stepType === 'ai-review' && correct ? 1 : 0),
      };
      if (event.payload.confidence) {
        next = {
          ...next,
          calibrationAnswers: [
            ...next.calibrationAnswers,
            { confidence: event.payload.confidence, correct },
          ],
        };
      }
      return refreshSolidHistory(next, concept, at);
    }

    case 'review_graded': {
      const { cardKey, concept, rating, retrievabilityBefore, state: cardState } = event.payload;
      const priorCard = state.cards[cardKey];
      let next: ProgressState = {
        ...state,
        cards: { ...state.cards, [cardKey]: cardState },
        cardConcept: { ...state.cardConcept, [cardKey]: concept },
        // A concept can have memory evidence (a reviewed card) with no skill-item
        // attempt yet; ensure it has a record so masteryOf/masteryState still see it.
        concepts: { ...state.concepts, [concept]: state.concepts[concept] ?? emptyConceptRecord() },
      };

      if (cardKey.startsWith('lesson:')) {
        const wasScheduled =
          priorCard === undefined || new Date(priorCard.due).getTime() <= at.getTime();
        const xp = xpFor({
          kind: 'recall',
          score: scoreFromRating(rating),
          retrievabilityBefore,
          wasScheduled,
          challengeFirstWrongAttempt: false,
          withinCooldown: withinCooldown(state, cardKey, event.at),
        });
        next = {
          ...next,
          xpByLocalDate: addXp(next, event.localDate, xp),
          lastGradedAt: { ...next.lastGradedAt, [cardKey]: event.at },
        };
      }
      return refreshSolidHistory(next, concept, at);
    }

    case 'lesson_completed':
      return {
        ...state,
        completedLessons: new Set(state.completedLessons).add(event.payload.lessonId),
        lessonCompletedOn:
          event.payload.lessonId in state.lessonCompletedOn
            ? state.lessonCompletedOn
            : { ...state.lessonCompletedOn, [event.payload.lessonId]: event.localDate },
      };

    case 'explain_back_graded': {
      const { lessonId, stepId, concept, rubricHits, localDate } = {
        ...event.payload,
        localDate: event.localDate,
      };
      const itemKey = `${lessonId}#${stepId}`;
      const score = EXPLAIN_BACK_SELF_GRADE_TO_SCORE[rubricHits];
      const passed = rubricHits === 3;
      const prev = state.concepts[concept] ?? emptyConceptRecord();
      const alpha = ALPHA_BY_FAMILY.produce;
      const nextRecord: ConceptRecord = {
        ...prev,
        p: (1 - alpha) * prev.p + alpha * score,
        familiesPassed: passed ? new Set(prev.familiesPassed).add('produce') : prev.familiesPassed,
        produceOrExplainPassed: prev.produceOrExplainPassed || passed,
        successLocalDates: passed ? [...prev.successLocalDates, localDate] : prev.successLocalDates,
        attemptCount: prev.attemptCount + 1,
      };
      const xp = xpFor({
        kind: 'bug-hunt-ai-review-explain',
        score,
        wasScheduled: true,
        challengeFirstWrongAttempt: false,
        withinCooldown: withinCooldown(state, itemKey, event.at),
      });
      const next: ProgressState = {
        ...state,
        concepts: { ...state.concepts, [concept]: nextRecord },
        xpByLocalDate: addXp(state, localDate, xp),
        lastGradedAt: { ...state.lastGradedAt, [itemKey]: event.at },
      };
      return refreshSolidHistory(next, concept, at);
    }

    case 'capstone_completed': {
      const itemKey = `capstone#${event.payload.moduleId}`;
      const xp = xpFor({
        kind: 'capstone',
        score: 1,
        wasScheduled: true,
        challengeFirstWrongAttempt: false,
        withinCooldown: withinCooldown(state, itemKey, event.at),
      });
      return {
        ...state,
        completedCapstones: new Set(state.completedCapstones).add(event.payload.moduleId),
        xpByLocalDate: addXp(state, event.localDate, xp),
        lastGradedAt: { ...state.lastGradedAt, [itemKey]: event.at },
      };
    }

    case 'capstone_adr_written': {
      const { partId } = event.payload;
      const previous = state.capstoneAdrs[partId];
      const adr: CapstoneAdr = {
        ...event.payload,
        firstWrittenOn: previous?.firstWrittenOn ?? event.localDate,
        updatedOn: event.localDate,
        revisions: (previous?.revisions ?? 0) + 1,
      };
      return { ...state, capstoneAdrs: { ...state.capstoneAdrs, [partId]: adr } };
    }

    case 'incident_resolved': {
      const itemKey = `incident#${event.payload.incidentId}`;
      const xp = xpFor({
        kind: 'incident',
        score: event.payload.score,
        wasScheduled: true,
        challengeFirstWrongAttempt: false,
        withinCooldown: withinCooldown(state, itemKey, event.at),
      });
      return {
        ...state,
        resolvedIncidents: [...state.resolvedIncidents, event.payload],
        xpByLocalDate: addXp(state, event.localDate, xp),
        lastGradedAt: { ...state.lastGradedAt, [itemKey]: event.at },
      };
    }

    case 'test_out_attempted': {
      const { moduleId, score, passed } = event.payload;
      const attempts = state.testOuts[moduleId] ?? [];
      let next: ProgressState = {
        ...state,
        testOuts: { ...state.testOuts, [moduleId]: [...attempts, { score, passed, at: event.at }] },
      };
      if (passed) {
        const itemKey = `testout#${moduleId}`;
        const xp = xpFor({
          kind: 'test-out',
          score: 1,
          wasScheduled: true,
          challengeFirstWrongAttempt: false,
          withinCooldown: withinCooldown(state, itemKey, event.at),
        });
        next = {
          ...next,
          xpByLocalDate: addXp(next, event.localDate, xp),
          lastGradedAt: { ...next.lastGradedAt, [itemKey]: event.at },
        };
      }
      return next;
    }

    case 'path_exam_attempted': {
      // No XP: the exam's items already earned theirs as step_answered events.
      const { pathId, ...facts } = event.payload;
      const attempt: PathExamAttempt = { ...facts, localDate: event.localDate };
      return {
        ...state,
        pathExams: {
          ...state.pathExams,
          [pathId]: [...(state.pathExams[pathId] ?? []), attempt],
        },
      };
    }

    case 'online_test_submitted': {
      // A sitting is shown skill under a clock, so it earns XP for its score, per task. The
      // same test again within a day earns nothing, like any other repeated item.
      const itemKey = `online-test#${event.payload.testKey}`;
      const xp =
        xpFor({
          kind: 'timed-task',
          score: scoreTallies(event.payload.tasks),
          wasScheduled: true,
          challengeFirstWrongAttempt: false,
          withinCooldown: withinCooldown(state, itemKey, event.at),
        }) * event.payload.tasks.length;
      const next: ProgressState = {
        ...state,
        onlineTests: [...state.onlineTests, { ...event.payload, localDate: event.localDate }],
      };
      if (xp === 0) return next;
      return {
        ...next,
        xpByLocalDate: addXp(next, event.localDate, xp),
        lastGradedAt: { ...next.lastGradedAt, [itemKey]: event.at },
      };
    }

    case 'profile_set':
      return { ...state, profile: event.payload };

    case 'custom_path_set': {
      const { pathId, ...path } = event.payload;
      const ownPaths = new Map(state.ownPaths);
      if (path.lessonIds.length === 0) ownPaths.delete(pathId);
      else ownPaths.set(pathId, { id: pathId, ...path });
      return { ...state, ownPaths };
    }

    case 'milestone_marked': {
      const { pathId, milestone, met } = event.payload;
      const marked = new Set(state.milestonesMet.get(pathId));
      if (met) marked.add(milestone);
      else marked.delete(milestone);
      const milestonesMet = new Map(state.milestonesMet);
      milestonesMet.set(pathId, marked);
      return { ...state, milestonesMet };
    }

    case 'news_read':
      return { ...state, newsRead: new Set(state.newsRead).add(event.payload.date) };

    case 'plan_set':
      return { ...state, plan: event.payload };

    case 'plan_cleared':
      return { ...state, plan: undefined };

    case 'goal_tier_set':
      return { ...state, goalTier: event.payload.tier };

    case 'mode_set':
      return {
        ...state,
        modeByModule: { ...state.modeByModule, [event.payload.moduleId]: event.payload.mode },
      };

    case 'setting_changed':
      return {
        ...state,
        settings: { ...state.settings, [event.payload.key]: event.payload.value },
      };

    case 'reading_collected':
      return {
        ...state,
        collectedReadings: new Set(state.collectedReadings).add(event.payload.referenceKey),
      };

    case 'words_added': {
      const deck = new Map(state.vocabulary.deck);
      for (const id of event.payload.termIds) if (!deck.has(id)) deck.set(id, event.localDate);
      return { ...state, vocabulary: { ...state.vocabulary, deck } };
    }

    case 'words_removed': {
      const deck = new Map(state.vocabulary.deck);
      for (const id of event.payload.termIds) deck.delete(id);
      return { ...state, vocabulary: { ...state.vocabulary, deck } };
    }

    case 'word_reviewed': {
      const { termId, rating, correct, retrievabilityBefore, state: card } = event.payload;
      const { vocabulary } = state;
      const prior = vocabulary.cards[termId];
      const itemKey = `word#${termId}`;
      // A word is recall, like a fact card: the same base, spacing bonus and cram rule.
      const xp = xpFor({
        kind: 'recall',
        score: scoreFromRating(rating),
        retrievabilityBefore,
        wasScheduled: prior === undefined || new Date(prior.due).getTime() <= at.getTime(),
        challengeFirstWrongAttempt: false,
        withinCooldown: withinCooldown(state, itemKey, event.at),
      });
      return {
        ...state,
        vocabulary: {
          ...vocabulary,
          cards: { ...vocabulary.cards, [termId]: card },
          reviews: vocabulary.reviews + 1,
          correct: vocabulary.correct + (correct ? 1 : 0),
          reviewedOn: {
            ...vocabulary.reviewedOn,
            [event.localDate]: (vocabulary.reviewedOn[event.localDate] ?? 0) + 1,
          },
        },
        xpByLocalDate: addXp(state, event.localDate, xp),
        lastGradedAt: { ...state.lastGradedAt, [itemKey]: event.at },
      };
    }

    case 'word_round_finished':
      // No XP: a round is a game that can be replayed at once, and XP is not for grinding.
      return {
        ...state,
        vocabulary: {
          ...state.vocabulary,
          rounds: [...state.vocabulary.rounds, { ...event.payload, localDate: event.localDate }],
        },
      };

    case 'ai_hours_reported':
    case 'session_started':
    case 'session_finished':
      // Facts recorded for their own features (the weekly AI self-report, session
      // summaries); nothing here currently derives from them.
      return state;
  }
}

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

function sortKey(event: StoryEvent | UnknownEvent): readonly [string, string, number] {
  if (event.type === 'unknown') return ['', '', 0];
  return [event.at, event.deviceId, event.seq];
}

/** Sorts by (at, deviceId, seq) and de-duplicates by id, so two devices holding the
 * same set of events derive the same state regardless of merge order
 * (docs/SYNC-PROTOCOL.md). Unknown events are ignored. */
export function reduce(events: readonly (StoryEvent | UnknownEvent)[]): ProgressState {
  const seen = new Set<string>();
  const ordered = [...events]
    .filter((e) => {
      if (e.type === 'unknown') return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (ka[0] !== kb[0]) return ka[0] < kb[0] ? -1 : 1;
      if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
      return ka[2] - kb[2];
    });
  return ordered.reduce(applyEvent, initialProgressState());
}
