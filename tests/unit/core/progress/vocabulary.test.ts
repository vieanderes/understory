import { describe, expect, it } from 'vitest';
import { fixedClock } from '@/core/ports/clock';
import { makeEvent, type StoryEvent } from '@/core/progress/events';
import { reduce } from '@/core/progress/reducer';
import { upcast } from '@/core/progress/upcast';
import { schedule } from '@/core/scheduling';

let n = 0;
function at(iso: string, deviceId = 'device-1') {
  return {
    clock: fixedClock(iso),
    ids: {
      next: () => {
        n += 1;
        return `018f0e60-0000-7000-8000-${String(n).padStart(12, '0')}`;
      },
    },
    deviceId,
    nextSeq: () => n,
    contentRev: 'rev-1',
    localDate: iso.slice(0, 10),
  };
}

const DAY1 = '2026-10-01T09:00:00.000Z';
const DAY2 = '2026-10-02T09:00:00.000Z';

function reviewed(
  iso: string,
  termId: string,
  rating: 1 | 2 | 3 | 4,
  prior?: ReturnType<typeof schedule>,
) {
  return makeEvent(at(iso), 'word_reviewed', {
    termId,
    drill: 'meaning',
    correct: rating > 1,
    rating,
    state: schedule(prior ?? null, rating, new Date(iso)),
  });
}

describe('vocabulary events', () => {
  it('validate their payloads', () => {
    expect(() => makeEvent(at(DAY1), 'words_added', { termIds: [] })).toThrow();
    expect(() => makeEvent(at(DAY1), 'words_added', { termIds: ['Not An Id'] })).toThrow();
    expect(() =>
      makeEvent(at(DAY1), 'word_round_finished', {
        right: 5,
        total: 4,
        seconds: 60,
        scope: 'deck',
      }),
    ).toThrow();
  });

  it('survive a round trip through upcast', () => {
    const event = makeEvent(at(DAY1), 'words_added', { termIds: ['closure'] });
    expect(upcast(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });
});

describe('the vocabulary read model', () => {
  it('builds the deck from adds and removes, keeping the day each word joined', () => {
    const state = reduce([
      makeEvent(at(DAY1), 'words_added', { termIds: ['closure', 'scope', 'hoisting'] }),
      makeEvent(at(DAY2), 'words_added', { termIds: ['closure', 'cache'] }),
      makeEvent(at(DAY2), 'words_removed', { termIds: ['scope'] }),
    ]);
    expect([...state.vocabulary.deck.entries()]).toEqual([
      ['closure', '2026-10-01'],
      ['hoisting', '2026-10-01'],
      ['cache', '2026-10-02'],
    ]);
  });

  it('keeps a removed word’s card, so adding it back resumes its schedule', () => {
    const first = reviewed(DAY1, 'closure', 3);
    const state = reduce([
      makeEvent(at(DAY1), 'words_added', { termIds: ['closure'] }),
      first,
      makeEvent(at(DAY2), 'words_removed', { termIds: ['closure'] }),
    ]);
    expect(state.vocabulary.deck.has('closure')).toBe(false);
    expect(state.vocabulary.cards.closure?.reps).toBe(1);
  });

  it('schedules each word, counts reviews and right answers by day, and earns recall XP', () => {
    const first = reviewed(DAY1, 'closure', 3);
    const second = reviewed(DAY2, 'closure', 1, (first.payload as { state: never }).state);
    const state = reduce([
      makeEvent(at(DAY1), 'words_added', { termIds: ['closure'] }),
      first,
      second,
    ]);
    expect(state.vocabulary.cards.closure?.lapses).toBe(1);
    expect(state.vocabulary.reviews).toBe(2);
    expect(state.vocabulary.correct).toBe(1);
    expect(state.vocabulary.reviewedOn).toEqual({ '2026-10-01': 1, '2026-10-02': 1 });
    expect(state.xpByLocalDate['2026-10-01']).toBeGreaterThan(0);
  });

  it('pays nothing for the same word twice within a day', () => {
    const first = reviewed(DAY1, 'closure', 3);
    const again = reviewed('2026-10-01T10:00:00.000Z', 'closure', 3);
    const once = reduce([first]).xpByLocalDate['2026-10-01'];
    expect(reduce([first, again]).xpByLocalDate['2026-10-01']).toBe(once);
  });

  it('keeps every speed round, with the learner’s date', () => {
    const state = reduce([
      makeEvent(at(DAY1), 'word_round_finished', {
        right: 12,
        total: 15,
        seconds: 60,
        scope: 'deck',
      }),
    ]);
    expect(state.vocabulary.rounds).toEqual([
      { right: 12, total: 15, seconds: 60, scope: 'deck', localDate: '2026-10-01' },
    ]);
  });

  it('merges two devices in any order', () => {
    const a = makeEvent(at(DAY1, 'a'), 'words_added', { termIds: ['closure'] });
    const b = makeEvent(at(DAY2, 'b'), 'words_removed', { termIds: ['closure'] });
    const events: StoryEvent[] = [a, b];
    expect(reduce(events).vocabulary.deck.size).toBe(0);
    expect(reduce([...events].reverse()).vocabulary.deck.size).toBe(0);
  });
});
