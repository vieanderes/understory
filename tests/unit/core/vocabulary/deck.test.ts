import { describe, expect, it } from 'vitest';
import type { VocabularyState } from '@/core/progress';
import type { CardState } from '@/core/scheduling';
import {
  areaFluency,
  deckSummary,
  dueWords,
  fluencyLevel,
  freshWords,
  starterWords,
  wordOfTheDay,
  wordTier,
} from '@/core/vocabulary/deck';

const NOW = new Date('2026-10-08T09:00:00.000Z');

const card = (stability: number, due: string, reps = 1): CardState => ({
  due,
  stability,
  difficulty: 5,
  reps,
  lapses: 0,
  state: 'review',
  scheduledDays: Math.round(stability),
  elapsedDays: 0,
});

const vocab = (over: Partial<VocabularyState> = {}): VocabularyState => ({
  deck: new Map(),
  cards: {},
  reviews: 0,
  correct: 0,
  reviewedOn: {},
  rounds: [],
  ...over,
});

describe('wordTier', () => {
  it('reads the tier from stability, so a lapse drops a word back', () => {
    expect(wordTier(undefined)).toBe('new');
    expect(wordTier(card(0, NOW.toISOString(), 0))).toBe('new');
    expect(wordTier(card(2, '2026-10-10T00:00:00.000Z'))).toBe('learning');
    expect(wordTier(card(9, '2026-10-17T00:00:00.000Z'))).toBe('familiar');
    expect(wordTier(card(30, '2026-11-07T00:00:00.000Z'))).toBe('fluent');
  });
});

describe('the deck', () => {
  const state = vocab({
    deck: new Map([
      ['closure', '2026-10-01'],
      ['scope', '2026-10-01'],
      ['cache', '2026-10-02'],
      ['hoisting', '2026-10-03'],
      ['idempotent', '2026-10-03'],
    ]),
    cards: {
      closure: card(3, '2026-10-07T09:00:00.000Z'),
      scope: card(3, '2026-10-05T09:00:00.000Z'),
      cache: card(25, '2026-11-01T09:00:00.000Z'),
      // Not in the deck any more: never due.
      monad: card(1, '2026-10-01T09:00:00.000Z'),
    },
  });

  it('lists due words in the deck, longest overdue first', () => {
    expect(dueWords(state, NOW)).toEqual(['scope', 'closure']);
  });

  it('lists words never reviewed, easiest level first, then the order they joined', () => {
    const levels = new Map([
      ['hoisting', 2],
      ['idempotent', 1],
    ]);
    expect(freshWords(state, (id) => levels.get(id) ?? 3)).toEqual(['idempotent', 'hoisting']);
  });

  it('sums the deck up', () => {
    expect(deckSummary(state, NOW)).toEqual({
      words: 5,
      due: 2,
      fresh: 2,
      learning: 2,
      familiar: 0,
      fluent: 1,
    });
  });
});

describe('fluency', () => {
  it('names a level from the share of an area known', () => {
    expect(fluencyLevel(0, 0)).toBe('tourist');
    expect(fluencyLevel(4, 20)).toBe('tourist');
    expect(fluencyLevel(5, 20)).toBe('conversational');
    expect(fluencyLevel(12, 20)).toBe('fluent');
    expect(fluencyLevel(18, 20)).toBe('native');
  });

  it('counts every area of the glossary, known meaning familiar or fluent', () => {
    const words = [
      { id: 'closure', area: 'javascript' },
      { id: 'scope', area: 'javascript' },
      { id: 'cache', area: 'system-design' },
    ];
    const state = vocab({
      cards: {
        closure: card(9, '2026-10-17T00:00:00.000Z'),
        cache: card(1, '2026-10-09T00:00:00.000Z'),
      },
    });
    expect(areaFluency(words, state)).toEqual([
      { area: 'javascript', total: 2, started: 1, known: 1, fluent: 0, level: 'conversational' },
      { area: 'system-design', total: 1, started: 1, known: 0, fluent: 0, level: 'tourist' },
    ]);
  });
});

describe('wordOfTheDay', () => {
  const words = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, level: 1 }));

  it('is the same all day and changes the next day', () => {
    const today = wordOfTheDay(words, '2026-10-08', new Set());
    expect(wordOfTheDay(words, '2026-10-08', new Set())).toBe(today);
    const week = ['09', '10', '11', '12', '13'].map((d) =>
      wordOfTheDay(words, `2026-10-${d}`, new Set()),
    );
    expect(new Set([today, ...week]).size).toBeGreaterThan(1);
  });

  it('prefers a word not in the deck yet', () => {
    const deck = new Set(['a', 'b', 'c', 'd']);
    expect(wordOfTheDay(words, '2026-10-08', deck)).toBe('e');
  });

  it('prefers the first two levels, and has nothing to say without words', () => {
    const mixed = [
      { id: 'deep', level: 3 },
      { id: 'core', level: 1 },
    ];
    expect(wordOfTheDay(mixed, '2026-10-08', new Set())).toBe('core');
    expect(wordOfTheDay([], '2026-10-08', new Set())).toBeUndefined();
    expect(wordOfTheDay([{ id: 'deep', level: 3 }], '2026-10-08', new Set(['deep']))).toBe('deep');
  });
});

describe('starterWords', () => {
  it('takes everyday words from each area in turn', () => {
    const words = [
      { id: 'a1', area: 'a', level: 1 },
      { id: 'a2', area: 'a', level: 1 },
      { id: 'a3', area: 'a', level: 2 },
      { id: 'b1', area: 'b', level: 1 },
    ];
    expect(starterWords(words, 3)).toEqual(['a1', 'b1', 'a2']);
    expect(starterWords(words, 10)).toEqual(['a1', 'b1', 'a2']);
  });
});
