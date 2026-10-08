import type { VocabularyState } from '@/core/progress/reducer';
import type { CardState } from '@/core/scheduling/card-state';
import { termHash } from '@/core/content/style';

/*
 * What the deck says about a learner, derived from the cards and never stored (AGENTS.md,
 * law 3). A word's tier follows its FSRS stability, the days it would take to fall to 90%
 * recall: a lapse drops stability, so a forgotten word drops a tier on its own.
 */

export type WordTier = 'new' | 'learning' | 'familiar' | 'fluent';

/** A week of stability: the word survives a week without practice. */
export const FAMILIAR_DAYS = 7;
/** Three weeks: the word is part of how you talk. */
export const FLUENT_DAYS = 21;

export function wordTier(card: CardState | undefined): WordTier {
  if (!card || card.reps === 0) return 'new';
  if (card.stability >= FLUENT_DAYS) return 'fluent';
  if (card.stability >= FAMILIAR_DAYS) return 'familiar';
  return 'learning';
}

const known = (tier: WordTier) => tier === 'familiar' || tier === 'fluent';

/** Words in the deck whose card is due, longest overdue first. */
export function dueWords(vocabulary: VocabularyState, now: Date): string[] {
  const nowMs = now.getTime();
  return [...vocabulary.deck.keys()]
    .flatMap((id) => {
      const card = vocabulary.cards[id];
      if (!card || card.reps === 0) return [];
      const due = new Date(card.due).getTime();
      return due <= nowMs ? [{ id, due }] : [];
    })
    .sort((a, b) => a.due - b.due)
    .map((w) => w.id);
}

/** Words in the deck never reviewed: the easiest level first, then the order they joined. */
export function freshWords(vocabulary: VocabularyState, levelOf: (id: string) => number): string[] {
  return [...vocabulary.deck.keys()]
    .map((id, order) => ({ id, order, level: levelOf(id) }))
    .filter(({ id }) => wordTier(vocabulary.cards[id]) === 'new')
    .sort((a, b) => a.level - b.level || a.order - b.order)
    .map((w) => w.id);
}

export interface DeckSummary {
  words: number;
  due: number;
  fresh: number;
  learning: number;
  familiar: number;
  fluent: number;
}

export function deckSummary(vocabulary: VocabularyState, now: Date): DeckSummary {
  const tiers = [...vocabulary.deck.keys()].map((id) => wordTier(vocabulary.cards[id]));
  const count = (tier: WordTier) => tiers.filter((t) => t === tier).length;
  return {
    words: vocabulary.deck.size,
    due: dueWords(vocabulary, now).length,
    fresh: count('new'),
    learning: count('learning'),
    familiar: count('familiar'),
    fluent: count('fluent'),
  };
}

export type FluencyLevel = 'tourist' | 'conversational' | 'fluent' | 'native';

export const FLUENCY_LABEL: Record<FluencyLevel, string> = {
  tourist: 'Tourist',
  conversational: 'Conversational',
  fluent: 'Fluent',
  native: 'Native',
};

/** A quarter of an area's words lets you follow the conversation; nine in ten is home. */
export function fluencyLevel(knownWords: number, total: number): FluencyLevel {
  if (total === 0) return 'tourist';
  const share = knownWords / total;
  if (share >= 0.9) return 'native';
  if (share >= 0.6) return 'fluent';
  if (share >= 0.25) return 'conversational';
  return 'tourist';
}

export interface AreaFluency {
  area: string;
  total: number;
  /** Words reviewed at least once. */
  started: number;
  /** Familiar or fluent. */
  known: number;
  fluent: number;
  level: FluencyLevel;
}

/** One row per area, in the order the words come, whether or not the deck holds them. */
export function areaFluency(
  words: readonly { id: string; area: string }[],
  vocabulary: VocabularyState,
): AreaFluency[] {
  const rows = new Map<string, { total: number; started: number; known: number; fluent: number }>();
  for (const word of words) {
    const tier = wordTier(vocabulary.cards[word.id]);
    const row = rows.get(word.area) ?? { total: 0, started: 0, known: 0, fluent: 0 };
    rows.set(word.area, {
      total: row.total + 1,
      started: row.started + (tier === 'new' ? 0 : 1),
      known: row.known + (known(tier) ? 1 : 0),
      fluent: row.fluent + (tier === 'fluent' ? 1 : 0),
    });
  }
  return [...rows.entries()].map(([area, row]) => ({
    area,
    ...row,
    level: fluencyLevel(row.known, row.total),
  }));
}

/**
 * One word a day, the same on every device for the date. It prefers a word outside the deck
 * at the first two levels, so it is a small, useful surprise rather than a deep cut.
 */
export function wordOfTheDay(
  words: readonly { id: string; level: number }[],
  localDate: string,
  deck: ReadonlySet<string>,
): string | undefined {
  const pools = [
    words.filter((w) => w.level <= 2 && !deck.has(w.id)),
    words.filter((w) => !deck.has(w.id)),
    words,
  ];
  const pool = pools.find((p) => p.length > 0);
  if (!pool) return undefined;
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1));
  return sorted[parseInt(termHash(`word-of-the-day:${localDate}`), 36) % sorted.length]?.id;
}

/** A first handful for an empty deck: everyday words, one area at a time, in area order. */
export function starterWords(
  words: readonly { id: string; area: string; level: number }[],
  count: number,
): string[] {
  const byArea = new Map<string, string[]>();
  for (const word of words.filter((w) => w.level === 1)) {
    byArea.set(word.area, [...(byArea.get(word.area) ?? []), word.id]);
  }
  const queues = [...byArea.values()];
  const picked: string[] = [];
  for (let round = 0; picked.length < count && queues.some((q) => q.length > round); round++) {
    for (const queue of queues) {
      const id = queue[round];
      if (id !== undefined && picked.length < count) picked.push(id);
    }
  }
  return picked;
}
