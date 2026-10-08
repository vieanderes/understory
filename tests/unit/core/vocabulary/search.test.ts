import { describe, expect, it } from 'vitest';
import { firstMention, says, wordPattern } from '@/core/vocabulary/match';
import {
  editDistance,
  normalise,
  searchWords,
  type SearchableWord,
} from '@/core/vocabulary/search';

describe('wordPattern', () => {
  it('finds a word in any case, as a plural, across a hyphen or a space', () => {
    expect(says('Two Closures here', ['closure'])).toBe(true);
    expect(says('a pure-function', ['pure function'])).toBe(true);
    expect(says("the cache's size", ['cache'])).toBe(true);
    expect(says('a process and a thread', ['process'])).toBe(true);
  });

  it('never matches inside a longer word', () => {
    expect(says('enclosure', ['closure'])).toBe(false);
    expect(says('caches_ok', ['cache'])).toBe(false);
  });

  it('works for words made of symbols', () => {
    expect(says('use === here', ['==='])).toBe(true);
    expect(wordPattern('N+1 query').test('the N+1 query again')).toBe(true);
    expect(says('nothing', ['', '  '])).toBe(false);
  });

  it('reports the first mention, longest name first', () => {
    expect(firstMention('A pure function is a function.', ['function', 'pure function'])).toEqual({
      index: 2,
      length: 13,
    });
    expect(firstMention('nothing here', ['closure'])).toBeUndefined();
  });
});

describe('normalise and editDistance', () => {
  it('folds case, accents, hyphens and underscores', () => {
    expect(normalise('  Café_Au-Lait ')).toBe('cafe au lait');
  });

  it('counts a swap of two letters as one edit', () => {
    expect(editDistance('closure', 'clsoure')).toBe(1);
    expect(editDistance('cache', 'cash')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });
});

const words: SearchableWord[] = [
  {
    id: 'closure',
    term: 'closure',
    aka: ['lexical closure'],
    short: 'A function that keeps its surroundings.',
  },
  { id: 'cache', term: 'cache', aka: [], short: 'A fast copy kept close to where it is needed.' },
  {
    id: 'idempotent',
    term: 'idempotent',
    aka: ['idempotency'],
    short: 'Doing it twice changes nothing more.',
  },
  {
    id: 'cache-stampede',
    term: 'cache stampede',
    aka: ['dogpile'],
    short: 'Many requests rebuild one missing value at once.',
  },
  {
    id: 'n-plus-one',
    term: 'N+1 query',
    aka: [],
    short: 'One query, then one more for every row.',
  },
];

const ids = (query: string) => searchWords(words, query).map((w) => w.id);

describe('searchWords', () => {
  it('returns every word, in its order, for an empty query', () => {
    expect(ids('  ')).toEqual(words.map((w) => w.id));
  });

  it('puts an exact term first, then words that start with it', () => {
    expect(ids('cache')).toEqual(['cache', 'cache-stampede']);
  });

  it('finds a word by its nickname or alias', () => {
    expect(ids('dogpile')).toEqual(['cache-stampede']);
    expect(ids('idempotency')[0]).toBe('idempotent');
  });

  it('forgives a misspelling', () => {
    expect(ids('clousre')[0]).toBe('closure');
    expect(ids('idempotant')[0]).toBe('idempotent');
  });

  it('does not forgive too much in a short word', () => {
    expect(ids('cat')).toEqual([]);
  });

  it('searches inside the meaning when no name matches', () => {
    expect(ids('every row')).toEqual(['n-plus-one']);
  });

  it('matches symbols as typed', () => {
    expect(ids('n+1')).toEqual(['n-plus-one']);
  });
});
