import type { ProgressState } from '@/core/progress/reducer';
import type { CardState } from '@/core/scheduling/card-state';
import { retrievability } from '@/core/scheduling/fsrs';
import { mulberry32, shuffle } from '@/core/util/rng';
import type { Catalog } from './catalog';
import {
  dueByLowestRetrievability,
  earliestFutureDue,
  excludesTyping,
  rankByBandFit,
  sessionSize,
  skillCardKey,
  type DeviceKind,
  type SessionItem,
  type SessionMinutes,
  type SessionResult,
} from './session';

/*
 * A part checkpoint (LEARNING-SCIENCE.md, C, "Parts and milestones"): one finite session of
 * cumulative mixed review across a whole part, built from the same items and the same
 * selection rules as a practice session. Every concept of the part is a queue; the queues
 * are visited weakest first, one item each per round, so the session interleaves the part
 * and gives the weak and the fading concepts the most room.
 */

/** One sitting. The same length as the default practice session. */
export const CHECKPOINT_MINUTES: SessionMinutes = 10;

/** B5: "a 20-minute boss set". A test-out is a longer checkpoint that is scored. */
export const TEST_OUT_MINUTES: SessionMinutes = 20;

/** B5: "Passing at 80% or more". */
export const TEST_OUT_PASS_SHARE = 0.8;

export function testOutPassed(right: number, total: number): boolean {
  return total > 0 && right / total >= TEST_OUT_PASS_SHARE;
}

export interface BuildCheckpointInput {
  readonly state: ProgressState;
  readonly catalog: Catalog;
  /** The part's concepts. Items for any other concept are left out. */
  readonly concepts: readonly string[];
  readonly now: Date;
  readonly device: DeviceKind;
  readonly seed: number;
  readonly minutes?: SessionMinutes;
}

const DAY_MS = 86_400_000;

function recallOf(card: CardState, now: Date): number {
  const elapsedDays = card.lastReview
    ? (now.getTime() - new Date(card.lastReview).getTime()) / DAY_MS
    : card.elapsedDays;
  return retrievability(card.stability, Math.max(0, elapsedDays));
}

/**
 * How much a concept needs this session: its missing skill plus how far its most
 * forgotten card has faded. A concept with no reviewed card has nothing known to fade,
 * so it is weighed by skill alone.
 */
function need(state: ProgressState, concept: string, now: Date): number {
  const weakness = 1 - (state.concepts[concept]?.p ?? 0);
  const recalls = Object.entries(state.cardConcept)
    .filter(([, c]) => c === concept)
    .flatMap(([key]) => state.cards[key] ?? [])
    .filter((card) => card.lastReview !== undefined)
    .map((card) => recallOf(card, now));
  const forgetting = recalls.length === 0 ? 0 : 1 - Math.min(...recalls);
  return weakness + forgetting;
}

export function buildCheckpoint(input: BuildCheckpointInput): SessionResult {
  const { state, catalog, now, device, seed } = input;
  const size = sessionSize(input.minutes ?? CHECKPOINT_MINUTES);
  const inPart = new Set(input.concepts);
  const due = dueByLowestRetrievability(state, now).filter((d) => inPart.has(d.concept));

  const queues = shuffle([...inPart], mulberry32(seed))
    .map((concept) => {
      const cards: SessionItem[] = due
        .filter((d) => d.concept === concept)
        .map((d) => ({ source: 'due', concept, cardKey: d.cardKey }));
      const skills: SessionItem[] = rankByBandFit(
        catalog.skillItems.filter((i) => i.concept === concept && !excludesTyping(device, i.type)),
        state.thetaByModule,
        catalog,
      ).map((i) => ({ source: 'interleave', concept, cardKey: skillCardKey(i) }));
      return { need: need(state, concept, now), items: [...cards, ...skills] };
    })
    .filter((queue) => queue.items.length > 0)
    // Stable sort: equal needs keep the seeded shuffle's order.
    .sort((a, b) => b.need - a.need);

  const items: SessionItem[] = [];
  for (let round = 0; items.length < size && queues.some((q) => q.items.length > round); round++) {
    for (const queue of queues) {
      const next = queue.items[round];
      if (next && items.length < size) items.push(next);
    }
  }

  const used = new Set(items.map((i) => i.cardKey));
  return { items, nextDueDate: earliestFutureDue(state, now, used) };
}
