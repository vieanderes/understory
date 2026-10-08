import type { WordDrill } from '@/core/progress/events';
import type { VocabularyState } from '@/core/progress/reducer';
import type { CardState, FsrsRating } from '@/core/scheduling/card-state';
import { mulberry32, shuffle, type Rng } from '@/core/util/rng';
import { dueWords, freshWords } from './deck';

/*
 * Drills that feel like a language app, not a textbook (LEARNING-SCIENCE.md B4 for the
 * schedule). A word is met by its meaning first (recognise), then asked for by its meaning
 * (recall), then heard in a sentence with a gap (use), then seen at work in code. The
 * impostors are the words a learner really confuses it with: its evil twin and its
 * relatives first, then words from the same area.
 */

export interface DrillWord {
  readonly id: string;
  readonly area: string;
  readonly level: number;
  readonly hasExample: boolean;
  readonly twin?: string;
  readonly related: readonly string[];
}

export interface IntroItem {
  readonly kind: 'intro';
  readonly termId: string;
}

export interface DrillItem {
  readonly kind: WordDrill;
  readonly termId: string;
  /** Word ids, the answer among them once. */
  readonly choices: readonly string[];
  readonly answer: number;
  /** False for practice that never touches the schedule: a second look, a retry, a round. */
  readonly graded: boolean;
}

export type SessionItem = IntroItem | DrillItem;

export const CHOICES = 4;
export const SESSION_SIZE = 15;
/** Few enough to remember tomorrow: new words are the expensive part of a deck. */
export const NEW_PER_SESSION = 5;
/** A right answer after this long was a struggle, and FSRS should hear so. */
export const SLOW_ANSWER_MS = 15_000;

/** Recall, then the gap, then code, rotating as the reviews add up. After a lapse, the meaning. */
export function drillFor(word: DrillWord, card: CardState | undefined): WordDrill {
  if (!card || card.reps === 0 || card.state === 'relearning') return 'meaning';
  const ladder: WordDrill[] = word.hasExample ? ['recall', 'gap', 'snippet'] : ['recall', 'gap'];
  return ladder[(card.reps - 1) % ladder.length]!;
}

export function choicesFor(
  word: DrillWord,
  words: readonly DrillWord[],
  rng: Rng,
): { choices: string[]; answer: number } {
  const others = words.filter((w) => w.id !== word.id);
  const known = new Set(others.map((w) => w.id));
  const close = [word.twin, ...word.related].filter(
    (id): id is string => id !== undefined && known.has(id),
  );
  const sameArea = shuffle(
    others.filter((w) => w.area === word.area && !close.includes(w.id)),
    rng,
  ).map((w) => w.id);
  const rest = shuffle(
    others.filter((w) => w.area !== word.area && !close.includes(w.id)),
    rng,
  ).map((w) => w.id);
  const impostors = [...new Set([...close, ...sameArea, ...rest])].slice(0, CHOICES - 1);
  const choices = shuffle([word.id, ...impostors], rng);
  return { choices, answer: choices.indexOf(word.id) };
}

function drill(
  kind: WordDrill,
  word: DrillWord,
  words: readonly DrillWord[],
  rng: Rng,
  graded: boolean,
): DrillItem {
  return { kind, termId: word.id, ...choicesFor(word, words, rng), graded };
}

export interface WordSession {
  readonly items: readonly SessionItem[];
  readonly due: number;
  readonly fresh: number;
}

/**
 * Due words first, as many as fit; then a few new ones, each met on a card and asked at
 * once; then a second, ungraded look at each new word, by recall, before the session ends.
 */
export function buildWordSession({
  words,
  vocabulary,
  now,
  seed,
  size = SESSION_SIZE,
  newPerSession = NEW_PER_SESSION,
}: {
  words: readonly DrillWord[];
  vocabulary: VocabularyState;
  now: Date;
  seed: number;
  size?: number;
  newPerSession?: number;
}): WordSession {
  const rng = mulberry32(seed);
  const byId = new Map(words.map((w) => [w.id, w]));
  const due = dueWords(vocabulary, now)
    .flatMap((id) => byId.get(id) ?? [])
    .slice(0, size);
  const fresh = freshWords(vocabulary, (id) => byId.get(id)?.level ?? 3)
    .flatMap((id) => byId.get(id) ?? [])
    .slice(0, Math.max(0, Math.min(newPerSession, size - due.length)));

  const items: SessionItem[] = [
    ...due.map((w) => drill(drillFor(w, vocabulary.cards[w.id]), w, words, rng, true)),
    ...fresh.flatMap((w): SessionItem[] => [
      { kind: 'intro', termId: w.id },
      drill('meaning', w, words, rng, true),
    ]),
    ...fresh.map((w) => drill('recall', w, words, rng, false)),
  ];
  return { items, due: due.length, fresh: fresh.length };
}

/** Wrong is Again. Right but slow is Hard. Right is Good: a tap among four is never Easy. */
export function ratingForAnswer(correct: boolean, ms: number): FsrsRating {
  if (!correct) return 1;
  return ms > SLOW_ANSWER_MS ? 2 : 3;
}

/**
 * A missed word comes back at the end, by its meaning, as practice. Only a graded miss: a
 * missed retry coming back again would let a session grow for ever.
 */
export function retryOf(
  item: DrillItem,
  words: readonly DrillWord[],
  rng: Rng,
): DrillItem | undefined {
  if (!item.graded) return undefined;
  const word = words.find((w) => w.id === item.termId);
  return word ? drill('meaning', word, words, rng, false) : undefined;
}

export const SPEED_ROUND_SECONDS = 60;

/** A round against the clock over `pool`: meaning, then recall, round and round. */
export function buildSpeedRound(
  pool: readonly string[],
  words: readonly DrillWord[],
  seed: number,
  count = 60,
): DrillItem[] {
  const rng = mulberry32(seed);
  const byId = new Map(words.map((w) => [w.id, w]));
  const chosen = pool.flatMap((id) => byId.get(id) ?? []);
  if (chosen.length === 0) return [];
  const order: DrillWord[] = [];
  while (order.length < count) order.push(...shuffle(chosen, rng));
  return order
    .slice(0, count)
    .map((w, i) => drill(i % 2 === 0 ? 'meaning' : 'recall', w, words, rng, false));
}
