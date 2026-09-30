import {
  applyWeeks,
  calibrationGap,
  GOAL_XP_BY_TIER,
  rankFor,
  weekKey,
  type GoalTier,
  type Rank,
  type WeeklyGoalSummary,
} from '../gamification';
import { hasFluentSpacing, masteryOf, masteryState, type MasteryState } from '../mastery';
import type { CatalogFile, CatalogFileConcept } from '../practice';
import type { ProgressState } from '../progress';
import { retrievability, type CardState } from '../scheduling';
import { journeyProgress, type ConceptStateOf, type JourneyProgress } from './parts';
import { journeyTime, type JourneyTime } from './time';

/*
 * The read side. Everything the Today, Map and Practise screens show is computed here
 * from two inputs, the folded event log and the content index, plus the clock. Nothing
 * on those screens is stored: mastery decays with time, so it has to be derived at the
 * moment of looking.
 */

const DAY_MS = 86_400_000;

/** The goal used until the learner picks one. Tetzlaff et al.: when in doubt, less load. */
export const DEFAULT_GOAL_TIER: GoalTier = 'steady';

/** Modules whose Fluent counts gate the Architect rank (LEARNING-SCIENCE, section C). */
export const KEY_MODULE_IDS = ['db', 'scale', 'arch', 'cloud'] as const;

export interface ConceptView {
  readonly id: string;
  readonly moduleId: string;
  readonly title: string;
  readonly summary: string;
  readonly state: MasteryState;
  /** 0..1. */
  readonly mastery: number;
  /** Mean retrievability of the concept's reviewed cards, 0..1, or null with no cards. */
  readonly recall: number | null;
  /** ISO instant of the earliest due card, or null. */
  readonly nextDue: string | null;
  readonly dueNow: boolean;
}

function cardsOf(state: ProgressState, conceptId: string): CardState[] {
  return Object.entries(state.cardConcept)
    .filter(([, concept]) => concept === conceptId)
    .flatMap(([key]) => state.cards[key] ?? []);
}

function recallOf(cards: readonly CardState[], now: Date): number | null {
  const reviewed = cards.filter((card) => card.lastReview !== undefined);
  if (reviewed.length === 0) return null;
  const total = reviewed.reduce((sum, card) => {
    const elapsed = Math.max(
      0,
      (now.getTime() - new Date(card.lastReview as string).getTime()) / DAY_MS,
    );
    return sum + retrievability(card.stability, elapsed);
  }, 0);
  return total / reviewed.length;
}

export function conceptView(
  concept: CatalogFileConcept,
  state: ProgressState,
  now: Date,
): ConceptView {
  const record = state.concepts[concept.id];
  const cards = cardsOf(state, concept.id);
  const assumed = record?.assumed ?? state.assumedConcepts.has(concept.id);
  const hasEvidence =
    (record?.attemptCount ?? 0) > 0 || cards.some((c) => c.lastReview !== undefined);

  const mastery = record
    ? masteryOf(
        {
          p: record.p,
          familiesPassed: record.familiesPassed,
          produceOrExplainPassed: record.produceOrExplainPassed,
        },
        cards,
        now,
      )
    : 0;

  const meanStabilityDays =
    cards.length === 0 ? 0 : cards.reduce((sum, card) => sum + card.stability, 0) / cards.length;

  const dueTimes = cards.map((card) => card.due).sort();
  const nextDue = dueTimes[0] ?? null;

  return {
    id: concept.id,
    moduleId: concept.moduleId,
    title: concept.title,
    summary: concept.summary,
    mastery,
    recall: recallOf(cards, now),
    nextDue,
    dueNow: nextDue !== null && new Date(nextDue).getTime() <= now.getTime(),
    state: masteryState({
      mastery,
      hasEvidence,
      assumed,
      wasEverSolidOrFluent: record?.wasEverSolidOrFluent ?? false,
      meanStabilityDays,
      fluentSpacingMet: hasFluentSpacing(record?.successLocalDates ?? []),
    }),
  };
}

export function conceptViews(catalog: CatalogFile, state: ProgressState, now: Date): ConceptView[] {
  return catalog.concepts.map((concept) => conceptView(concept, state, now));
}

// ---------------------------------------------------------------------------
// Due
// ---------------------------------------------------------------------------

export interface DueSummary {
  readonly dueNow: number;
  /** Due cards whose recall has fallen under 0.75: about to be lost. */
  readonly nearlyForgotten: number;
  /** ISO instant of the next card that is not yet due, or null. */
  readonly nextDue: string | null;
  readonly started: number;
}

export const NEARLY_FORGOTTEN_BELOW = 0.75;

export function dueSummary(state: ProgressState, now: Date): DueSummary {
  let dueNow = 0;
  let nearlyForgotten = 0;
  let nextDue: string | null = null;
  const cards = Object.values(state.cards);
  for (const card of cards) {
    if (new Date(card.due).getTime() <= now.getTime()) {
      dueNow += 1;
      const r = recallOf([card], now);
      if (r !== null && r < NEARLY_FORGOTTEN_BELOW) nearlyForgotten += 1;
    } else if (nextDue === null || card.due < nextDue) {
      nextDue = card.due;
    }
  }
  return { dueNow, nearlyForgotten, nextDue, started: cards.length };
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

export interface WeekView extends WeeklyGoalSummary {
  readonly tier: GoalTier;
  readonly goal: number;
  readonly xpThisWeek: number;
  readonly met: boolean;
}

/** Every ISO week from the first active one to the current one, including empty weeks. */
function weekKeysBetween(firstLocalDate: string, today: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${firstLocalDate}T12:00:00Z`);
  const end = new Date(`${today}T12:00:00Z`);
  while (cursor.getTime() <= end.getTime() + 6 * DAY_MS) {
    const key = weekKey(cursor.toISOString().slice(0, 10));
    if (keys.at(-1) !== key) keys.push(key);
    if (key === weekKey(today)) break;
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return keys;
}

export function weekView(state: ProgressState, today: string): WeekView {
  const tier = state.goalTier ?? DEFAULT_GOAL_TIER;
  const goal = GOAL_XP_BY_TIER[tier];
  const xpByWeek = new Map<string, number>();
  for (const [date, xp] of Object.entries(state.xpByLocalDate)) {
    const key = weekKey(date);
    xpByWeek.set(key, (xpByWeek.get(key) ?? 0) + xp);
  }

  const thisWeek = weekKey(today);
  const xpThisWeek = xpByWeek.get(thisWeek) ?? 0;
  const firstDate = Object.keys(state.xpByLocalDate).sort()[0];

  // The run counts finished weeks. The current week only joins it once its goal is met,
  // so an unfinished week never reads as a miss.
  const finished = firstDate
    ? weekKeysBetween(firstDate, today)
        .filter((key) => key !== thisWeek)
        .map((key) => ({ weekKey: key, xp: xpByWeek.get(key) ?? 0, tier }))
    : [];
  const met = xpThisWeek >= goal;
  const summary = applyWeeks(
    met ? [...finished, { weekKey: thisWeek, xp: xpThisWeek, tier }] : finished,
  );

  return { ...summary, tier, goal, xpThisWeek, met };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface Overview {
  readonly concepts: readonly ConceptView[];
  readonly due: DueSummary;
  readonly week: WeekView;
  readonly rank: Rank;
  readonly calibration: { readonly gapPoints: number | undefined; readonly sampleSize: number };
  readonly gaps: readonly ConceptView[];
  readonly solidCount: number;
  readonly started: boolean;
  /** Progress through the parts of the course, and which part is current. */
  readonly journey: JourneyProgress;
  /** Estimated minutes for the whole journey and each part, with what is left. */
  readonly time: JourneyTime;
}

const SOLID_OR_BETTER: ReadonlySet<MasteryState> = new Set(['solid', 'fluent']);

export function overview(
  catalog: CatalogFile,
  state: ProgressState,
  now: Date,
  today: string,
): Overview {
  const concepts = conceptViews(catalog, state, now);
  const calibration = calibrationGap(state.calibrationAnswers);
  const solidCount = concepts.filter((c) => SOLID_OR_BETTER.has(c.state)).length;
  const stateById = new Map(concepts.map((c) => [c.id, c.state]));
  const stateOf: ConceptStateOf = (id) => stateById.get(id) ?? 'unseen';

  const rank = rankFor({
    placementDone: state.placementsCompleted > 0,
    solidCount,
    capstonesCompleted: state.completedCapstones.size,
    // A capstone closes each part. A course without parts falls back to one per module.
    totalCapstones: catalog.parts.length > 0 ? catalog.parts.length : catalog.modules.length,
    aiReviewsPassed: state.aiReviewsPassed,
    calibrationGapPoints: calibration.gapPoints,
    incidentsResolved: state.resolvedIncidents.length,
    fluentCountByKeyModule: KEY_MODULE_IDS.map(
      (moduleId) => concepts.filter((c) => c.moduleId === moduleId && c.state === 'fluent').length,
    ),
    totalConcepts: catalog.concepts.length,
  });

  return {
    concepts,
    due: dueSummary(state, now),
    week: weekView(state, today),
    rank,
    calibration,
    gaps: concepts.filter((c) => c.state === 'gap'),
    solidCount,
    journey: journeyProgress(catalog.parts, state, stateOf),
    time: journeyTime({
      lessons: Object.entries(catalog.lessons).map(([id, lesson]) => ({
        id,
        minutes: lesson.minutes,
      })),
      parts: catalog.parts,
      state,
      stateOf,
    }),
    started:
      state.placementsCompleted > 0 ||
      Object.keys(state.concepts).length > 0 ||
      Object.keys(state.cards).length > 0,
  };
}
