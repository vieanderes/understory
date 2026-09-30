/*
 * One placement session (LEARNING-SCIENCE.md B1): the staircase from `ladder.ts`, walked
 * over the rungs and items of the ladder content, and turned into what the rest of the
 * app needs, a starting theta per module and the concepts it may assume.
 *
 * Nothing is shown between items, so the session holds no feedback, only facts.
 */

import { moduleOfConcept } from '@/core/content/placement-schema';
import type { Confidence } from '@/core/progress/events';
import { initialLadderState, stepLadder, type LadderState } from './ladder';

export type StartedAs = 'new' | 'ai-builder' | 'experienced';

/**
 * B1: the one opening question "sets only the starting rung". Someone new starts at the
 * bottom. Someone who builds with AI has read a lot of code but may have skipped the
 * fundamentals, so they start on the last chapter 0 rung, where a gap still shows. An
 * experienced developer starts in the middle and the staircase finds the rest.
 */
export const START_RUNG: Readonly<Record<StartedAs, number>> = {
  new: 1,
  'ai-builder': 3,
  experienced: 5,
};

/** The part of a ladder rung the session needs. Compiled rungs fit this shape. */
export interface PlacementRungSpec {
  readonly rung: number;
  readonly moduleBand: readonly string[];
  readonly concepts: readonly string[];
  readonly items: readonly { readonly id: string; readonly concept: string }[];
}

export interface PlacementAnswer {
  readonly itemId: string;
  readonly rung: number;
  readonly concept: string;
  readonly moduleId: string;
  readonly correct: boolean;
  readonly confidence: Confidence;
}

export interface PlacementSession {
  readonly startedAs: StartedAs;
  /** How many ladders this learner finished before. It rotates the items. */
  readonly attempt: number;
  readonly ladder: LadderState;
  readonly answers: readonly PlacementAnswer[];
}

export interface CurrentPlacementItem {
  readonly id: string;
  readonly rung: number;
  readonly concept: string;
  readonly moduleId: string;
}

export function startPlacement(
  startedAs: StartedAs,
  attempt = 0,
  topRung = Number.POSITIVE_INFINITY,
): PlacementSession {
  return {
    startedAs,
    attempt,
    ladder: initialLadderState(START_RUNG[startedAs], topRung),
    answers: [],
  };
}

function rungAt(rungs: readonly PlacementRungSpec[], rung: number) {
  return rungs.find((r) => r.rung === rung);
}

/**
 * The item to show now, or null when the ladder is over. Items on a rung are taken in
 * turn from an offset that moves with each attempt, so a second ladder opens on a
 * different snippet. A rung whose items are all used ends the ladder early: showing an
 * item twice would measure memory of the item, not skill.
 */
export function currentPlacementItem(
  session: PlacementSession,
  rungs: readonly PlacementRungSpec[],
): CurrentPlacementItem | null {
  if (session.ladder.done) return null;
  const rung = rungAt(rungs, session.ladder.rung);
  if (!rung || rung.items.length === 0) return null;
  const visits = session.answers.filter((a) => a.rung === rung.rung).length;
  if (visits >= rung.items.length) return null;
  const item = rung.items[(session.attempt + visits) % rung.items.length];
  /* v8 ignore next -- the index is always in range after the length checks above */
  if (!item) return null;
  return {
    id: item.id,
    rung: rung.rung,
    concept: item.concept,
    moduleId: moduleOfConcept(item.concept),
  };
}

/** Records one answer. An answer to anything but the current item changes nothing. */
export function answerPlacement(
  session: PlacementSession,
  rungs: readonly PlacementRungSpec[],
  answer: { readonly itemId: string; readonly correct: boolean; readonly confidence: Confidence },
): PlacementSession {
  const item = currentPlacementItem(session, rungs);
  if (!item || item.id !== answer.itemId) return session;
  const topRung = Math.max(...rungs.map((r) => r.rung));
  return {
    ...session,
    ladder: stepLadder(session.ladder, answer.correct, topRung),
    answers: [
      ...session.answers,
      {
        itemId: item.id,
        rung: item.rung,
        concept: item.concept,
        moduleId: item.moduleId,
        correct: answer.correct,
        confidence: answer.confidence,
      },
    ],
  };
}

/**
 * B5 rates items `800 + 200 * d` for difficulty 1 to 5, within a module. A module whose
 * band is the final rung starts in the middle of that scale (d 3). Each rung the band
 * sits below the final rung adds a step, each rung above takes one away, clamped to the
 * scale, so a learner is neither flattered nor buried by one short ladder.
 */
const ITEM_RATING_BASE = 800;
const ITEM_RATING_STEP = 200;
const MIDDLE_DIFFICULTY = 3;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 5;

export function thetaForBand(finalRung: number, bandRung: number): number {
  const d = Math.min(
    MAX_DIFFICULTY,
    Math.max(MIN_DIFFICULTY, MIDDLE_DIFFICULTY + finalRung - bandRung),
  );
  return ITEM_RATING_BASE + ITEM_RATING_STEP * d;
}

export interface PlacementOutcome {
  readonly finalRung: number;
  readonly stopReason: 'reversals' | 'items' | 'exhausted';
  readonly thetaByModule: Readonly<Record<string, number>>;
  /** B1: "Concepts below the final rung are marked assumed." */
  readonly assumedConcepts: readonly string[];
}

export function placementOutcome(
  session: PlacementSession,
  rungs: readonly PlacementRungSpec[],
): PlacementOutcome {
  const finalRung = session.ladder.rung;

  // A module in two bands is rated by the higher band, the more demanding claim.
  const bandRungByModule = new Map<string, number>();
  for (const rung of rungs) {
    for (const moduleId of rung.moduleBand) {
      bandRungByModule.set(moduleId, Math.max(bandRungByModule.get(moduleId) ?? 0, rung.rung));
    }
  }
  const thetaByModule: Record<string, number> = {};
  for (const [moduleId, bandRung] of bandRungByModule) {
    thetaByModule[moduleId] = thetaForBand(finalRung, bandRung);
  }

  // Assuming a concept the learner just got wrong would hide the very gap placement found.
  const missed = new Set(
    session.answers
      .filter((a) => !a.correct)
      .map((a) => a.concept)
      .filter((concept) => !session.answers.some((a) => a.correct && a.concept === concept)),
  );
  const assumedConcepts = [
    ...new Set(
      rungs
        .filter((r) => r.rung < finalRung)
        .flatMap((r) => r.concepts)
        .filter((concept) => !missed.has(concept)),
    ),
  ];

  return {
    finalRung,
    stopReason: session.ladder.stopReason ?? 'exhausted',
    thetaByModule,
    assumedConcepts,
  };
}
