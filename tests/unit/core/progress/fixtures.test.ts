import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  calibrationGap,
  rankFor,
  applyWeeks,
  weekKey,
  type GoalTier,
  type Rank,
  type WeekRecord,
} from '@/core/gamification';
import { hasFluentSpacing, masteryOf, masteryState, type ConceptEvidence } from '@/core/mastery';
import { fixedClock } from '@/core/ports/clock';
import type { IdGen } from '@/core/ports/id-gen';
import {
  makeEvent,
  type EventType,
  type MakeEventDeps,
  type PayloadOf,
  type StoryEvent,
} from '@/core/progress/events';
import { reduce, type CapstoneAdr, type ProgressState } from '@/core/progress/reducer';
import type { CardState } from '@/core/scheduling/card-state';

/*
 * Golden fixtures: the cross-platform contract for the future Swift port
 * (docs/SYNC-PROTOCOL.md "iOS reducer"). Each fixture is {name, events, now,
 * expected}. This file both regenerates them (`REGENERATE_FIXTURES=1`) and, in the
 * normal run, asserts the TypeScript reducer still reproduces the committed values.
 *
 * Rounding: `masteryByConcept` is rounded to 4 dp, matching the deliverable brief, so
 * the fixture stays stable across floating-point differences between platforms.
 */

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../contracts/fixtures',
);
const REGENERATE = process.env.REGENERATE_FIXTURES === '1';

/** One shared, monotonic id source per fixture, so every event gets a distinct id
 * (a fresh generator per event would give every call its own "first" id). */
function sharedIdGen(): IdGen {
  let i = 0;
  return {
    next: () => {
      i += 1;
      return `018f0e60-0000-7000-8000-${String(i).padStart(12, '0')}`;
    },
  };
}

function deps(ids: IdGen, deviceId: string, at: string, seqRef: { seq: number }): MakeEventDeps {
  return {
    clock: fixedClock(at),
    ids,
    deviceId,
    nextSeq: () => {
      seqRef.seq += 1;
      return seqRef.seq;
    },
    contentRev: 'fixture-rev',
    localDate: at.slice(0, 10),
  };
}

/** A tiny, declarative way to describe a fixture's events: (type, payload, at). */
interface EventSpec<T extends EventType> {
  readonly type: T;
  readonly payload: PayloadOf<T>;
  readonly at: string;
  readonly deviceId?: string;
}

function buildEvents(specs: readonly EventSpec<EventType>[]): StoryEvent[] {
  const ids = sharedIdGen();
  const seqByDevice = new Map<string, { seq: number }>();
  return specs.map((spec) => {
    const deviceId = spec.deviceId ?? 'device-1';
    const seqRef = seqByDevice.get(deviceId) ?? { seq: 0 };
    seqByDevice.set(deviceId, seqRef);
    return makeEvent(deps(ids, deviceId, spec.at, seqRef), spec.type, spec.payload);
  });
}

interface FixtureExpected {
  readonly xpTotal: number;
  readonly weeks: { readonly run: number; readonly bestRun: number; readonly reserve: number };
  readonly rank: Rank;
  readonly masteryByConcept: Readonly<Record<string, number>>;
  readonly states: Readonly<Record<string, string>>;
  readonly calibrationGap: number | undefined;
  /** Present only when the log holds a decision record, so the older fixtures, written
   * before records existed, keep their exact bytes. */
  readonly adrs?: Readonly<Record<string, CapstoneAdr>>;
}

interface Fixture {
  readonly name: string;
  readonly events: readonly StoryEvent[];
  readonly now: string;
  readonly expected: FixtureExpected;
}

function conceptCards(state: ProgressState, concept: string): CardState[] {
  return Object.entries(state.cardConcept)
    .filter(([, c]) => c === concept)
    .map(([cardKey]) => state.cards[cardKey])
    .filter((c): c is CardState => c !== undefined);
}

const ONE_DAY_MS = 86_400_000;

/** Walks every calendar day from the first XP-earning day to `now`, so a week with no
 * activity still becomes an explicit `{ xp: 0 }` record (a genuine "missed week"),
 * not simply absent from the list. */
function buildWeekRecords(state: ProgressState, now: Date, tier: GoalTier): WeekRecord[] {
  const localDates = Object.keys(state.xpByLocalDate).sort();
  const firstDate = localDates[0];
  if (firstDate === undefined) return [];

  const weekXp = new Map<string, number>();
  for (let t = new Date(`${firstDate}T00:00:00Z`).getTime(); t <= now.getTime(); t += ONE_DAY_MS) {
    const localDate = new Date(t).toISOString().slice(0, 10);
    const key = weekKey(localDate);
    weekXp.set(key, (weekXp.get(key) ?? 0) + (state.xpByLocalDate[localDate] ?? 0));
  }
  return [...weekXp.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([wk, xp]) => ({ weekKey: wk, xp, tier }));
}

/** Derives the same summary a client (or the Swift port) would show the learner,
 * purely from the reducer's `ProgressState`. `goalTier` and `totalConcepts` stand in
 * for catalog data the reducer itself does not hold. */
function deriveExpected(state: ProgressState, now: Date, goalTier: GoalTier): FixtureExpected {
  const xpTotal = Object.values(state.xpByLocalDate).reduce((a, b) => a + b, 0);
  const weeklySummary = applyWeeks(buildWeekRecords(state, now, goalTier));

  const masteryByConcept: Record<string, number> = {};
  const states: Record<string, string> = {};
  for (const [concept, record] of Object.entries(state.concepts)) {
    const cards = conceptCards(state, concept);
    const evidence: ConceptEvidence = {
      p: record.p,
      familiesPassed: record.familiesPassed,
      produceOrExplainPassed: record.produceOrExplainPassed,
    };
    const mastery = masteryOf(evidence, cards, now);
    masteryByConcept[concept] = Math.round(mastery * 10_000) / 10_000;
    const meanStabilityDays =
      cards.length === 0 ? 0 : cards.reduce((s, c) => s + c.stability, 0) / cards.length;
    states[concept] = masteryState({
      assumed: record.assumed,
      hasEvidence: record.attemptCount > 0 || cards.length > 0,
      wasEverSolidOrFluent: record.wasEverSolidOrFluent,
      mastery,
      meanStabilityDays,
      fluentSpacingMet: hasFluentSpacing(record.successLocalDates),
    });
  }

  const solidCount = Object.values(states).filter((s) => s === 'solid' || s === 'fluent').length;
  const rank = rankFor({
    placementDone: Object.keys(state.thetaByModule).length > 0,
    solidCount,
    capstonesCompleted: state.completedCapstones.size,
    totalCapstones: Math.max(1, state.completedCapstones.size),
    aiReviewsPassed: state.aiReviewsPassed,
    calibrationGapPoints: calibrationGap(state.calibrationAnswers).gapPoints,
    incidentsResolved: state.resolvedIncidents.length,
    fluentCountByKeyModule: [0, 0, 0, 0],
    totalConcepts: Math.max(1, Object.keys(state.concepts).length),
  });

  return {
    xpTotal,
    weeks: {
      run: weeklySummary.run,
      bestRun: weeklySummary.bestRun,
      reserve: weeklySummary.reserve,
    },
    rank,
    masteryByConcept,
    states,
    calibrationGap: calibrationGap(state.calibrationAnswers).gapPoints,
    ...(Object.keys(state.capstoneAdrs).length === 0 ? {} : { adrs: state.capstoneAdrs }),
  };
}

const scenarios: {
  name: string;
  goalTier: GoalTier;
  now: string;
  specs: EventSpec<EventType>[];
}[] = [
  {
    name: 'single-recall-review',
    goalTier: 'light',
    now: '2026-09-17T12:00:00Z',
    specs: [
      {
        type: 'review_graded',
        at: '2026-09-17T10:00:00Z',
        payload: {
          cardKey: 'lesson:js.closures#card-1',
          concept: 'js.closures',
          rating: 3,
          state: {
            due: '2026-09-24T10:00:00.000Z',
            stability: 7,
            difficulty: 5,
            reps: 1,
            lapses: 0,
            state: 'review',
            scheduledDays: 7,
            elapsedDays: 0,
            lastReview: '2026-09-17T10:00:00.000Z',
          },
        },
      },
    ],
  },
  {
    name: 'building-mastery-from-scratch',
    goalTier: 'light',
    now: '2026-09-20T10:00:00Z',
    specs: [1, 2, 3].map((n) => ({
      type: 'step_answered' as const,
      at: `2026-09-1${6 + n}T10:00:00Z`,
      payload: {
        lessonId: 'js.closures',
        stepId: `step-${n}`,
        stepType: 'predict-output' as const,
        concept: 'js.closures',
        difficulty: 2,
        tryNumber: 1,
        hintsUsed: 0,
        revealed: false,
        score: 1,
        correct: true,
        mode: 'guided' as const,
        context: 'lesson' as const,
      },
    })),
  },
  {
    name: 'challenge-first-wrong-attempt',
    goalTier: 'light',
    now: '2026-09-17T12:00:00Z',
    specs: [
      {
        type: 'step_answered',
        at: '2026-09-17T10:00:00Z',
        payload: {
          lessonId: 'js.async',
          stepId: 'attempt-1',
          stepType: 'code-challenge',
          concept: 'js.async',
          difficulty: 3,
          tryNumber: 1,
          hintsUsed: 0,
          revealed: false,
          score: 0,
          correct: false,
          mode: 'challenge-first',
          context: 'lesson',
        },
      },
    ],
  },
  {
    name: 'capstone-and-incident',
    goalTier: 'steady',
    now: '2026-09-17T12:00:00Z',
    specs: [
      { type: 'capstone_completed', at: '2026-09-17T10:00:00Z', payload: { moduleId: 'js' } },
      {
        type: 'incident_resolved',
        at: '2026-09-17T10:05:00Z',
        payload: { incidentId: 'oversell', concept: 'db.transactions', score: 1 },
      },
    ],
  },
  {
    name: 'calibration-overconfidence',
    goalTier: 'light',
    now: '2026-09-17T12:00:00Z',
    specs: Array.from({ length: 5 }, (_, i) => ({
      type: 'step_answered' as const,
      at: `2026-09-17T10:0${i}:00Z`,
      payload: {
        lessonId: 'js.security',
        stepId: `q-${i}`,
        stepType: 'multiple-choice' as const,
        concept: 'js.security',
        difficulty: 2,
        tryNumber: 1,
        hintsUsed: 0,
        revealed: false,
        score: i < 2 ? 1 : 0,
        correct: i < 2,
        confidence: 'certain' as const,
        mode: 'guided' as const,
        context: 'lesson' as const,
      },
    })),
  },
  {
    // A capstone built on the phone, its decision record written there, then edited on
    // the laptop two days later. The edit wins, the first version stays in the log, and
    // the record earns no XP: 100 is the capstone's alone.
    name: 'capstone-decision-record',
    goalTier: 'light',
    now: '2026-09-20T12:00:00Z',
    specs: [
      {
        type: 'capstone_completed',
        at: '2026-09-17T10:00:00Z',
        payload: { moduleId: 'servers' },
        deviceId: 'phone',
      },
      {
        type: 'capstone_adr_written',
        at: '2026-09-17T10:05:00Z',
        payload: {
          partId: 'servers',
          title: 'Keep sessions in memory',
          context: 'One server process for now.',
          decision: 'A map in memory holds the sessions.',
        },
        deviceId: 'phone',
      },
      {
        type: 'capstone_adr_written',
        at: '2026-09-19T08:00:00Z',
        payload: {
          partId: 'servers',
          title: 'Keep sessions in the database',
          context: 'A second server process joined.',
          decision: 'Sessions live in a table.',
          alternatives: 'A map in memory. A signed cookie.',
          consequences: 'One more query per request.',
        },
        deviceId: 'laptop',
      },
    ],
  },
  {
    name: 'weekly-goal-run-and-miss',
    goalTier: 'light',
    // Up to and including the second missed week (2026-W40), so both W39 and W40
    // are walked as explicit zero-XP weeks by buildWeekRecords.
    now: '2026-09-29T10:00:00Z',
    specs: [
      // Week 2026-W38 (14-20 Sep): 200 XP, clearing the Light tier's 150.
      { type: 'capstone_completed', at: '2026-09-15T10:00:00Z', payload: { moduleId: 'js' } },
      { type: 'capstone_completed', at: '2026-09-16T10:00:00Z', payload: { moduleId: 'css' } },
      // Week 2026-W39 (21-27 Sep): no activity. The starting reserve (1) is spent
      // automatically, so the run continues.
      // Week 2026-W40 (28 Sep onwards, up to `now`): no activity either. With the
      // reserve now spent, this week ends the run.
    ],
  },
];

function loadFixture(name: string): Fixture {
  const raw = readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf8');
  return JSON.parse(raw) as Fixture;
}

function writeFixture(fixture: Fixture): void {
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(
    join(FIXTURES_DIR, `${fixture.name}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
    'utf8',
  );
}

describe('golden fixtures', () => {
  for (const scenario of scenarios) {
    it(`${scenario.name}: the reducer reproduces the committed fixture`, () => {
      const events = buildEvents(scenario.specs);
      const now = new Date(scenario.now);
      const state = reduce(events);
      const expected = deriveExpected(state, now, scenario.goalTier);
      const fixture: Fixture = { name: scenario.name, events, now: scenario.now, expected };

      if (REGENERATE) {
        writeFixture(fixture);
        return;
      }

      const committed = loadFixture(scenario.name);
      // Replay the committed events through the current reducer: this is the actual
      // cross-platform contract check (a future Swift reducer runs the same file).
      const replayed = reduce(committed.events);
      const replayedExpected = deriveExpected(replayed, new Date(committed.now), scenario.goalTier);
      expect(replayedExpected).toEqual(committed.expected);
      // The scenario as currently coded must also still match: catches drift between
      // the scenario definitions above and the committed JSON.
      expect(expected).toEqual(committed.expected);
    });
  }

  it('has at least 7 committed scenarios', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(7);
  });
});
