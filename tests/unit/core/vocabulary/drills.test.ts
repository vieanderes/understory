import { describe, expect, it } from 'vitest';
import type { VocabularyState } from '@/core/progress';
import type { CardState } from '@/core/scheduling';
import { mulberry32 } from '@/core/util/rng';
import {
  buildSpeedRound,
  buildWordSession,
  choicesFor,
  drillFor,
  ratingForAnswer,
  retryOf,
  SLOW_ANSWER_MS,
  type DrillItem,
  type DrillWord,
} from '@/core/vocabulary/drills';

const word = (id: string, over: Partial<DrillWord> = {}): DrillWord => ({
  id,
  area: 'javascript',
  level: 1,
  hasExample: false,
  related: [],
  ...over,
});

const WORDS: DrillWord[] = [
  word('closure', { twin: 'scope', related: ['hoisting'], hasExample: true }),
  word('scope'),
  word('hoisting'),
  word('cache', { area: 'system-design' }),
  word('queue', { area: 'system-design' }),
  word('promise'),
  word('callback'),
];
const BY_ID = new Map(WORDS.map((w) => [w.id, w]));

const card = (reps: number, due: string, lapses = 0): CardState => ({
  due,
  stability: 3,
  difficulty: 5,
  reps,
  lapses,
  state: 'review',
  scheduledDays: 3,
  elapsedDays: 0,
});

const NOW = new Date('2026-10-08T09:00:00.000Z');
const PAST = '2026-10-07T09:00:00.000Z';
const FUTURE = '2026-10-20T09:00:00.000Z';

const vocab = (deck: string[], cards: Record<string, CardState> = {}): VocabularyState => ({
  deck: new Map(deck.map((id) => [id, '2026-10-01'])),
  cards,
  reviews: 0,
  correct: 0,
  reviewedOn: {},
  rounds: [],
});

describe('drillFor', () => {
  it('meets a new word by its meaning first', () => {
    expect(drillFor(BY_ID.get('closure')!, undefined)).toBe('meaning');
  });

  it('moves on to recall, the gap and code as a word matures', () => {
    const closure = BY_ID.get('closure')!;
    expect(drillFor(closure, card(1, PAST))).toBe('recall');
    expect(drillFor(closure, card(2, PAST))).toBe('gap');
    expect(drillFor(closure, card(3, PAST))).toBe('snippet');
    expect(drillFor(closure, card(4, PAST))).toBe('recall');
  });

  it('skips the code drill for a word with no example', () => {
    const scope = BY_ID.get('scope')!;
    expect([1, 2, 3, 4].map((reps) => drillFor(scope, card(reps, PAST)))).toEqual([
      'recall',
      'gap',
      'recall',
      'gap',
    ]);
  });

  it('goes back to the meaning right after a lapse', () => {
    expect(drillFor(BY_ID.get('closure')!, { ...card(5, PAST, 1), state: 'relearning' })).toBe(
      'meaning',
    );
  });
});

describe('choicesFor', () => {
  it('offers four words, the answer among them once', () => {
    const { choices, answer } = choicesFor(BY_ID.get('promise')!, WORDS, mulberry32(1));
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices[answer]).toBe('promise');
  });

  it('makes the evil twin and related words the first impostors', () => {
    for (let seed = 0; seed < 10; seed++) {
      const { choices } = choicesFor(BY_ID.get('closure')!, WORDS, mulberry32(seed));
      expect(choices).toContain('scope');
      expect(choices).toContain('hoisting');
    }
  });

  it('prefers impostors from the same area', () => {
    const { choices } = choicesFor(BY_ID.get('cache')!, WORDS, mulberry32(3));
    expect(choices).toContain('queue');
  });

  it('copes with a tiny glossary', () => {
    const { choices } = choicesFor(word('a'), [word('a'), word('b')], mulberry32(1));
    expect([...choices].sort()).toEqual(['a', 'b']);
  });
});

describe('buildWordSession', () => {
  it('reviews due words first, then meets a few new ones', () => {
    const state = vocab(['closure', 'scope', 'cache', 'queue'], {
      closure: card(2, PAST),
      scope: card(1, FUTURE),
    });
    const session = buildWordSession({ words: WORDS, vocabulary: state, now: NOW, seed: 7 });
    expect(session.due).toBe(1);
    expect(session.fresh).toBe(2);
    expect(session.items.map((i) => `${i.kind}:${i.termId}`)).toEqual([
      'gap:closure',
      'intro:cache',
      'meaning:cache',
      'intro:queue',
      'meaning:queue',
      'recall:cache',
      'recall:queue',
    ]);
    // The second look at a new word is practice: it never touches the schedule.
    expect(
      session.items.filter((i) => i.kind !== 'intro' && !i.graded).map((i) => i.termId),
    ).toEqual(['cache', 'queue']);
  });

  it('caps new words, and brings none when the due pile fills the session', () => {
    const many = Array.from({ length: 12 }, (_, i) => word(`w${i}`));
    const all = [...WORDS, ...many];
    const fresh = buildWordSession({
      words: all,
      vocabulary: vocab(many.map((w) => w.id)),
      now: NOW,
      seed: 1,
      newPerSession: 3,
    });
    expect(fresh.fresh).toBe(3);

    const due = Object.fromEntries(many.map((w) => [w.id, card(1, PAST)]));
    const busy = buildWordSession({
      words: all,
      vocabulary: vocab([...many.map((w) => w.id), 'promise'], due),
      now: NOW,
      seed: 1,
      size: 10,
    });
    expect(busy.due).toBe(10);
    expect(busy.fresh).toBe(0);
    expect(busy.items).toHaveLength(10);
  });

  it('skips a deck word the glossary no longer has', () => {
    const session = buildWordSession({
      words: WORDS,
      vocabulary: vocab(['gone'], { gone: card(1, PAST) }),
      now: NOW,
      seed: 1,
    });
    expect(session.items).toEqual([]);
  });
});

describe('answers', () => {
  it('rates a miss Again, a slow right answer Hard and a right one Good', () => {
    expect(ratingForAnswer(false, 1000)).toBe(1);
    expect(ratingForAnswer(true, SLOW_ANSWER_MS + 1)).toBe(2);
    expect(ratingForAnswer(true, 3000)).toBe(3);
  });

  it('brings a missed word back at the end as ungraded practice of its meaning', () => {
    const session = buildWordSession({
      words: WORDS,
      vocabulary: vocab(['closure'], { closure: card(2, PAST) }),
      now: NOW,
      seed: 7,
    });
    const retry = retryOf(session.items[0] as DrillItem, WORDS, mulberry32(2));
    expect(retry).toMatchObject({ kind: 'meaning', termId: 'closure', graded: false });
    // A missed retry does not come back again, so a session always ends.
    expect(retryOf(retry!, WORDS, mulberry32(3))).toBeUndefined();
  });
});

describe('buildSpeedRound', () => {
  it('alternates meaning and recall over the pool, never graded', () => {
    const round = buildSpeedRound(['closure', 'scope', 'cache'], WORDS, 4, 6);
    expect(round).toHaveLength(6);
    expect(round.map((i) => i.kind)).toEqual([
      'meaning',
      'recall',
      'meaning',
      'recall',
      'meaning',
      'recall',
    ]);
    expect(round.every((i) => !i.graded && ['closure', 'scope', 'cache'].includes(i.termId))).toBe(
      true,
    );
  });

  it('is empty for an empty pool', () => {
    expect(buildSpeedRound([], WORDS, 1)).toEqual([]);
  });
});
