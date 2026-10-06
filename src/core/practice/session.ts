import { bandFit, DEFAULT_TARGET_BAND, expectedSuccess } from '@/core/mastery/difficulty';
import type { ProgressState } from '@/core/progress/reducer';
import { matchesInterests, type Interest } from '@/core/profile/interests';
import { retrievability } from '@/core/scheduling/fsrs';
import { mulberry32, shuffle, type Rng } from '@/core/util/rng';
import type { Catalog, CatalogRecallCard, CatalogSkillItem } from './catalog';

/*
 * Session composition (LEARNING-SCIENCE.md B2). Deterministic for a given seed, so
 * two learners who share a seed (the "same set" share link, section C) do the same
 * session.
 */

export type SessionMinutes = 5 | 10 | 20 | 45;
export type DeviceKind = 'phone' | 'desktop';
export type SessionItemSource = 'due' | 'interleave' | 'probe' | 'first-look';

export interface SessionItem {
  readonly source: SessionItemSource;
  readonly concept: string;
  /** `"lesson:<id>#<id>"` for a recall card, `"skill:<id>#<id>"` for a skill item,
   * matching the `cardKey` convention in progress/events.ts. */
  readonly cardKey: string;
}

export interface BuildSessionInput {
  readonly state: ProgressState;
  readonly catalog: Catalog;
  readonly now: Date;
  readonly minutes: SessionMinutes;
  readonly device: DeviceKind;
  readonly seed: number;
  /** Topics the learner chose for today. Empty or absent means the whole course. */
  readonly topics?: readonly Interest[];
}

export interface SessionResult {
  readonly items: readonly SessionItem[];
  /** Set when the queue was not full; the ISO date the next card falls due. */
  readonly nextDueDate: string | null;
}

/** B2: "A 10-minute session holds about 14 items." The doc gives one data point;
 * this is the simplest constant rate consistent with it (chosen reading, recorded in
 * docs/LEARNING-SCIENCE.md). */
const ITEMS_PER_MINUTE = 1.4;

/** B2: composition shares. */
const DUE_SHARE = 0.6;
const INTERLEAVE_SHARE = 0.25;
// The remaining share (0.15) is the probe/Signal slot; kept implicit so the three
// shares always sum to the session size exactly.

const DEFAULT_THETA = 1000; // itemRating(1) = 1000: a neutral starting point when a module has no theta yet.

export function sessionSize(minutes: SessionMinutes): number {
  return Math.max(1, Math.round(minutes * ITEMS_PER_MINUTE));
}

export function excludesTyping(device: DeviceKind, stepType: string): boolean {
  return device === 'phone' && stepType === 'code-challenge';
}

export function skillCardKey(item: CatalogSkillItem): string {
  return `skill:${item.lessonId}#${item.stepId}`;
}

/** Cards whose due date has passed, ordered by lowest retrievability first (B2: "60%
 * due FSRS items, sorted by lowest R first"). */
export function dueByLowestRetrievability(
  state: ProgressState,
  now: Date,
): { cardKey: string; concept: string }[] {
  const nowMs = now.getTime();
  return Object.entries(state.cards)
    .filter(([, card]) => new Date(card.due).getTime() <= nowMs)
    .map(([cardKey, card]) => {
      const elapsedDays = card.lastReview
        ? (nowMs - new Date(card.lastReview).getTime()) / 86_400_000
        : card.elapsedDays;
      return {
        cardKey,
        concept: state.cardConcept[cardKey] ?? '',
        r: retrievability(card.stability, elapsedDays),
      };
    })
    .sort((a, b) => a.r - b.r)
    .map(({ cardKey, concept }) => ({ cardKey, concept }));
}

export function earliestFutureDue(
  state: ProgressState,
  now: Date,
  excluding: ReadonlySet<string>,
): string | null {
  const nowMs = now.getTime();
  let earliest: string | null = null;
  for (const [cardKey, card] of Object.entries(state.cards)) {
    if (excluding.has(cardKey)) continue;
    const dueMs = new Date(card.due).getTime();
    if (dueMs <= nowMs) continue; // already due, not "next"
    if (earliest === null || dueMs < new Date(earliest).getTime()) earliest = card.due;
  }
  return earliest;
}

/** The two weakest concepts with at least one available skill item, preferring a
 * confusable pair when the weakest concept has one available (B2, principle 3). */
function pickInterleaveConcepts(state: ProgressState, catalog: Catalog, rng: Rng): string[] {
  const conceptsWithItems = new Set(catalog.skillItems.map((i) => i.concept));
  const candidates = catalog.concepts.filter((c) => conceptsWithItems.has(c.id));
  if (candidates.length === 0) return [];

  const pByConcept = (id: string) => state.concepts[id]?.p ?? 0;
  const sorted = shuffle(candidates, rng) // break ties deterministically but not always alphabetically
    .slice()
    .sort((a, b) => pByConcept(a.id) - pByConcept(b.id));

  const weakest = sorted[0];
  if (!weakest) return [];
  if (sorted.length === 1) return [weakest.id];

  const confusablePartner = (weakest.confusableWith ?? [])
    .filter((id) => conceptsWithItems.has(id))
    .sort((a, b) => pByConcept(a) - pByConcept(b))[0];

  if (confusablePartner) return [weakest.id, confusablePartner];
  const secondWeakest = sorted.find((c) => c.id !== weakest.id);
  return secondWeakest ? [weakest.id, secondWeakest.id] : [weakest.id];
}

/** Ranks candidate skill items towards the target predicted-success band, using the
 * module's theta (B5: "items picked toward predicted success 0.70 to 0.90"). */
export function rankByBandFit(
  items: readonly CatalogSkillItem[],
  theta: Readonly<Record<string, number>>,
  catalog: Catalog,
): CatalogSkillItem[] {
  const moduleOf = new Map(catalog.concepts.map((c) => [c.id, c.moduleId]));
  return [...items].sort((a, b) => {
    const thetaA = theta[moduleOf.get(a.concept) ?? ''] ?? DEFAULT_THETA;
    const thetaB = theta[moduleOf.get(b.concept) ?? ''] ?? DEFAULT_THETA;
    const fitA = bandFit(expectedSuccess(thetaA, a.difficulty), DEFAULT_TARGET_BAND);
    const fitB = bandFit(expectedSuccess(thetaB, b.difficulty), DEFAULT_TARGET_BAND);
    return fitA - fitB;
  });
}

/** Round-robins across concept queues, always preferring a queue whose next item
 * differs from the last one picked. This keeps same-concept runs at 1 whenever the
 * queues are balanced, and only repeats a concept when every other queue is empty
 * (the "when alternatives exist" escape clause in B2). */
function interleave(
  byConceptOrdered: readonly (readonly CatalogSkillItem[])[],
): CatalogSkillItem[] {
  const queues = byConceptOrdered.map((q) => [...q]);
  const out: CatalogSkillItem[] = [];
  let lastConcept: string | undefined;
  while (queues.some((q) => q.length > 0)) {
    let index = queues.findIndex((q) => q.length > 0 && q[0]?.concept !== lastConcept);
    if (index === -1) index = queues.findIndex((q) => q.length > 0);
    const queue = queues[index];
    const next = queue?.shift();
    if (!next) break;
    out.push(next);
    lastConcept = next.concept;
  }
  return out;
}

export function buildSession(input: BuildSessionInput): SessionResult {
  if (input.topics && input.topics.length > 0) return buildTopicSession(input, input.topics);
  const { state, catalog, now, minutes, device, seed } = input;
  const rng = mulberry32(seed);
  const size = sessionSize(minutes);
  const dueCount = Math.round(size * DUE_SHARE);
  const interleaveCount = Math.round(size * INTERLEAVE_SHARE);
  const probeCount = Math.max(0, size - dueCount - interleaveCount);

  const usedCardKeys = new Set<string>();

  // 1. Due items, lowest R first.
  const allDue = dueByLowestRetrievability(state, now);
  const dueItems: SessionItem[] = allDue.slice(0, dueCount).map((d) => {
    usedCardKeys.add(d.cardKey);
    return { source: 'due' as const, concept: d.concept, cardKey: d.cardKey };
  });

  // 2. Interleaved skill items for the two weakest concepts.
  const interleaveConcepts = pickInterleaveConcepts(state, catalog, rng);
  const availableSkillItems = (concept: string) =>
    catalog.skillItems.filter(
      (i) =>
        i.concept === concept &&
        !excludesTyping(device, i.type) &&
        !usedCardKeys.has(skillCardKey(i)),
    );
  const perConceptRanked = interleaveConcepts.map((c) =>
    rankByBandFit(availableSkillItems(c), state.thetaByModule, catalog),
  );
  const interleavedAll = interleave(perConceptRanked);
  const interleaveItems: SessionItem[] = interleavedAll.slice(0, interleaveCount).map((i) => {
    const cardKey = skillCardKey(i);
    usedCardKeys.add(cardKey);
    return { source: 'interleave' as const, concept: i.concept, cardKey };
  });

  // 3. One probe of an assumed concept (or a Signal card; Signal itself is out of
  // scope for src/core, so this only covers the assumed-concept probe).
  const probeItems: SessionItem[] = [];
  if (probeCount > 0) {
    const assumedWithItems = [...state.assumedConcepts].filter((c) =>
      catalog.skillItems.some(
        (i) =>
          i.concept === c && !excludesTyping(device, i.type) && !usedCardKeys.has(skillCardKey(i)),
      ),
    );
    const chosenConcept = assumedWithItems[Math.floor(rng.next() * assumedWithItems.length)];
    if (chosenConcept) {
      const candidate = rankByBandFit(
        availableSkillItems(chosenConcept),
        state.thetaByModule,
        catalog,
      )[0];
      if (candidate) {
        const cardKey = skillCardKey(candidate);
        usedCardKeys.add(cardKey);
        probeItems.push({ source: 'probe', concept: candidate.concept, cardKey });
      }
    }
  }

  const items = [...dueItems, ...interleaveItems, ...probeItems];

  if (items.length === 0) {
    return { items: [], nextDueDate: earliestFutureDue(state, now, usedCardKeys) };
  }
  return { items, nextDueDate: earliestFutureDue(state, now, usedCardKeys) };
}

/*
 * Practice by topic (LEARNING-SCIENCE.md B2, "Practice by topic"). The learner picks what to
 * practise today, whether or not the lessons are done. Due items of those topics come first,
 * up to the usual due share; then first looks at lessons not taken yet, which works as a
 * pretest before the lesson; then more due items, then mixed practice of lessons already done.
 */

/** Step types that stand on their own: read, pick or arrange, each with feedback that
 * explains the answer. Labs, sandboxes, written code and traces need the lesson around them. */
export const FIRST_LOOK_TYPES: ReadonlySet<string> = new Set([
  'multiple-choice',
  'predict-output',
  'fill-blank',
  'parsons',
  'bug-hunt',
]);

/** A first pass takes this many items from each lesson, so a session reaches several. */
const FIRST_LOOK_PER_LESSON = 2;

const CARD_KEY_LESSON = /^(?:lesson|skill):([^#]+)#/;

function lessonOfCardKey(cardKey: string): string | undefined {
  return CARD_KEY_LESSON.exec(cardKey)?.[1];
}

/** Takes from each queue in turn until all are empty. */
function roundRobin<T>(queues: readonly (readonly T[])[]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...queues.map((q) => q.length));
  for (let i = 0; i < longest; i += 1) {
    for (const queue of queues) {
      const next = queue[i];
      if (next !== undefined) out.push(next);
    }
  }
  return out;
}

interface FirstLook {
  readonly cardKey: string;
  readonly concept: string;
}

/**
 * One topic's first looks, in course order: the earliest untaken lesson first, its easiest
 * step and a recall card, then the next lesson. Whatever a lesson has left comes after every
 * lesson has had its turn. Catalog arrays keep the course order, so a lesson's place is
 * where its first item stands.
 */
function firstLooksFor(
  topic: Interest,
  state: ProgressState,
  catalog: Catalog,
  device: DeviceKind,
): FirstLook[] {
  const fresh = (lessonId: string) =>
    !state.completedLessons.has(lessonId) && matchesInterests(lessonId, [topic]);
  const byLesson = new Map<string, { skills: CatalogSkillItem[]; recalls: CatalogRecallCard[] }>();
  const entry = (lessonId: string) => {
    let found = byLesson.get(lessonId);
    if (!found) {
      found = { skills: [], recalls: [] };
      byLesson.set(lessonId, found);
    }
    return found;
  };
  for (const item of catalog.skillItems) {
    if (!fresh(item.lessonId) || !FIRST_LOOK_TYPES.has(item.type)) continue;
    if (excludesTyping(device, item.type) || state.cards[skillCardKey(item)]) continue;
    entry(item.lessonId).skills.push(item);
  }
  for (const card of catalog.recallCards) {
    if (!fresh(card.lessonId) || state.cards[recallCardKey(card)]) continue;
    entry(card.lessonId).recalls.push(card);
  }

  const perLesson = [...byLesson.values()].map(({ skills, recalls }) =>
    roundRobin<FirstLook>([
      [...skills]
        .sort((a, b) => a.difficulty - b.difficulty)
        .map((i) => ({ cardKey: skillCardKey(i), concept: i.concept })),
      recalls.map((c) => ({ cardKey: recallCardKey(c), concept: c.concept })),
    ]),
  );
  return [
    ...perLesson.flatMap((items) => items.slice(0, FIRST_LOOK_PER_LESSON)),
    ...perLesson.flatMap((items) => items.slice(FIRST_LOOK_PER_LESSON)),
  ];
}

export function recallCardKey(card: CatalogRecallCard): string {
  return `lesson:${card.lessonId}#${card.cardId}`;
}

function buildTopicSession(input: BuildSessionInput, topics: readonly Interest[]): SessionResult {
  const { state, catalog, now, minutes, device } = input;
  const size = sessionSize(minutes);
  const used = new Set<string>();
  const take = <T extends { cardKey: string }>(pool: readonly T[], count: number): T[] => {
    const out: T[] = [];
    for (const item of pool) {
      if (out.length >= count) break;
      if (used.has(item.cardKey)) continue;
      used.add(item.cardKey);
      out.push(item);
    }
    return out;
  };
  const inTopics = (cardKey: string) => {
    const lessonId = lessonOfCardKey(cardKey);
    return lessonId !== undefined && matchesInterests(lessonId, topics);
  };

  const due = dueByLowestRetrievability(state, now).filter((d) => inTopics(d.cardKey));
  const dueFirst = take(due, Math.round(size * DUE_SHARE));
  const firstLooks = take(
    roundRobin(topics.map((topic) => firstLooksFor(topic, state, catalog, device))),
    size - dueFirst.length,
  );
  const dueMore = take(due, size - dueFirst.length - firstLooks.length);

  const left = size - dueFirst.length - firstLooks.length - dueMore.length;
  const done = catalog.skillItems.filter(
    (i) =>
      state.completedLessons.has(i.lessonId) &&
      matchesInterests(i.lessonId, topics) &&
      !excludesTyping(device, i.type),
  );
  const concepts = [...new Set(done.map((i) => i.concept))].sort(
    (a, b) => (state.concepts[a]?.p ?? 0) - (state.concepts[b]?.p ?? 0),
  );
  const practice = take(
    interleave(
      concepts.map((c) =>
        rankByBandFit(
          done.filter((i) => i.concept === c),
          state.thetaByModule,
          catalog,
        ),
      ),
    ).map((i) => ({ cardKey: skillCardKey(i), concept: i.concept })),
    left,
  );

  const items: SessionItem[] = [
    ...[...dueFirst, ...dueMore].map((d) => ({ source: 'due' as const, ...d })),
    ...firstLooks.map((f) => ({ source: 'first-look' as const, ...f })),
    ...practice.map((p) => ({ source: 'interleave' as const, ...p })),
  ];
  return { items, nextDueDate: earliestFutureDue(state, now, used) };
}
