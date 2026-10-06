import { describe, expect, it } from 'vitest';
import {
  editionWeeks,
  neighbours,
  orderByInterest,
  storyLead,
  storySummary,
  withoutRepeatedWhy,
  type Brief,
} from '@/core/news';
import { item } from './helpers';

const brief = (overrides: Partial<Brief> = {}): Brief => ({
  whatHappened: 'PostgreSQL News published "Postgres 19 ships asynchronous I/O".',
  whyItMatters: 'Databases change what you can build.',
  keyConcepts: [
    { term: 'I/O', explanation: 'Reading and writing.' },
    { term: 'WAL', explanation: 'The write-ahead log.' },
  ],
  relatedLessons: [],
  recallCards: [],
  readingLevel: 'quick',
  generatedBy: 'extractive',
  ...overrides,
});

describe('storySummary', () => {
  it('keeps a model brief as written', () => {
    const text = 'Postgres 19 reads from disk without blocking a backend.';
    expect(storySummary(item({ brief: brief({ generatedBy: 'llm', whatHappened: text }) }))).toBe(
      text,
    );
  });

  it('drops the sentence that only repeats the headline', () => {
    const story = item({
      brief: brief({
        whatHappened:
          'PostgreSQL News published "Postgres 19 ships asynchronous I/O". Reads no longer block.',
      }),
    });
    expect(storySummary(story)).toBe('Reads no longer block.');
  });

  it('drops the Hacker News frame with its figures', () => {
    const story = item({
      brief: brief({
        whatHappened:
          '"Postgres 19 ships asynchronous I/O" reached the Hacker News front page with 382 points and 259 comments.',
      }),
    });
    expect(storySummary(story)).toBeNull();
  });

  it('falls back to the excerpt the source published, then to nothing', () => {
    expect(storySummary(item({ brief: brief(), excerpt: '  The release is out.  ' }))).toBe(
      'The release is out.',
    );
    expect(storySummary(item({ brief: brief() }))).toBeNull();
    expect(storySummary(item({ excerpt: 'No brief at all.' }))).toBe('No brief at all.');
  });
});

describe('storyLead', () => {
  const hnFrame =
    '"Postgres 19 ships asynchronous I/O" reached the Hacker News front page with 382 points and 259 comments.';

  it('opens with the summary when the brief says more than the headline', () => {
    const story = item({
      brief: brief({
        whatHappened:
          'PostgreSQL News published "Postgres 19 ships asynchronous I/O". Reads no longer block.',
      }),
    });
    expect(storyLead(story)).toEqual({ text: 'Reads no longer block.', from: 'summary' });
  });

  it('uses the excerpt next, cleaned and cut at a sentence near two lines', () => {
    const long =
      'Version 19 is out.   It reads from disk without blocking a backend, which matters for large scans. ' +
      'The planner also learns a new trick for joins on partitioned tables that saves a sort. ' +
      'Changes since the last release include: What';
    const lead = storyLead(item({ brief: brief({ whatHappened: hnFrame }), excerpt: long }));
    expect(lead).toEqual({
      text: 'Version 19 is out. It reads from disk without blocking a backend, which matters for large scans.',
      from: 'summary',
    });
  });

  it('cuts one long sentence at a word and marks the cut', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const lead = storyLead(item({ excerpt: words }));
    expect(lead?.text.endsWith('…')).toBe(true);
    expect(lead?.text.length).toBeLessThanOrEqual(161);
    expect(lead?.text).toMatch(/ word\d+…$/);
  });

  it('cuts a single unbroken run of text and keeps a why without a full stop', () => {
    expect(storyLead(item({ excerpt: 'x'.repeat(200) })).text).toBe(`${'x'.repeat(160)}…`);
    const story = item({
      brief: brief({ whatHappened: hnFrame, keyConcepts: [], whyItMatters: 'Databases matter' }),
    });
    expect(storyLead(story).text).toBe('Databases matter');
  });

  it('names the key concepts when the source said nothing', () => {
    const story = item({ brief: brief({ whatHappened: hnFrame }) });
    expect(storyLead(story)).toEqual({ text: 'About: I/O, WAL', from: 'concepts' });
  });

  it('falls back to a short why it matters without concepts', () => {
    const story = item({
      brief: brief({
        whatHappened: hnFrame,
        keyConcepts: [],
        whyItMatters: 'Databases change what you can build. A second sentence says more.',
      }),
    });
    expect(storyLead(story)).toEqual({
      text: 'Databases change what you can build.',
      from: 'why',
    });
  });

  it('never leaves a story with nothing to read', () => {
    expect(storyLead(item())).toEqual({
      text: 'No description from PostgreSQL News yet.',
      from: 'source',
    });
  });
});

describe('withoutRepeatedWhy', () => {
  it('keeps each reason once, the first time it appears', () => {
    const a = item({ id: 'a', brief: brief({ whyItMatters: 'Same.' }) });
    const b = item({ id: 'b', brief: brief({ whyItMatters: 'Same.' }) });
    const c = item({ id: 'c', brief: brief({ whyItMatters: 'Other.' }) });
    const d = item({ id: 'd' });
    expect(withoutRepeatedWhy([a, b, c, d])).toEqual(
      new Map([
        ['a', 'Same.'],
        ['b', null],
        ['c', 'Other.'],
        ['d', null],
      ]),
    );
  });
});

describe('orderByInterest', () => {
  const ai = item({ id: 'ai', topics: ['ai-agents'] });
  const web = item({ id: 'web', topics: ['web-platform'] });
  const db = item({ id: 'db', topics: ['security', 'databases'] });

  it('puts followed topics first and keeps the edition order otherwise', () => {
    const ordered = orderByInterest([ai, web, db], ['backend']);
    expect(ordered.map((s) => s.id)).toEqual(['db', 'ai', 'web']);
  });

  it('keeps the edition order with no interests', () => {
    expect(orderByInterest([ai, web, db], []).map((s) => s.id)).toEqual(['ai', 'web', 'db']);
  });
});

describe('editionWeeks', () => {
  it('groups editions newest first by ISO week, Monday first', () => {
    const weeks = editionWeeks([
      { date: '2026-10-06' },
      { date: '2026-10-05' },
      { date: '2026-10-04' },
      { date: '2026-09-28' },
    ]);
    expect(weeks.map((w) => [w.key, w.monday, w.editions.map((e) => e.date)])).toEqual([
      ['2026-W41', '2026-10-05', ['2026-10-06', '2026-10-05']],
      ['2026-W40', '2026-09-28', ['2026-10-04', '2026-09-28']],
    ]);
  });
});

describe('neighbours', () => {
  const keys = ['2026-10', '2026-09', '2026-08'];

  it('names the earlier and the later key in a newest-first list', () => {
    expect(neighbours(keys, '2026-09')).toEqual({ earlier: '2026-08', later: '2026-10' });
    expect(neighbours(keys, '2026-10')).toEqual({ earlier: '2026-09', later: undefined });
    expect(neighbours(keys, '2026-08')).toEqual({ earlier: undefined, later: '2026-09' });
  });

  it('knows no neighbours for a key it does not hold', () => {
    expect(neighbours(keys, '2025-01')).toEqual({ earlier: undefined, later: undefined });
  });
});
