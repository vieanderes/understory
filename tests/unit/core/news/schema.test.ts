import { describe, expect, it } from 'vitest';
import {
  EXCERPT_MAX_CHARS,
  briefSchema,
  interestsSchema,
  llmBriefSchema,
  newsDaySchema,
  newsItemSchema,
} from '@/core/news';
import { day, interests, item } from './helpers';

const brief = {
  whatHappened: 'A release happened.',
  whyItMatters: 'It changes upgrades.',
  keyConcepts: [
    { term: 'Index', explanation: 'A sorted structure.' },
    { term: 'Planner', explanation: 'Chooses a plan.' },
  ],
  relatedLessons: ['db.indexes'],
  readingLevel: 'quick',
  generatedBy: 'extractive',
};

describe('news schemas', () => {
  it('accept a plain item and a day', () => {
    expect(newsItemSchema.safeParse(item()).success).toBe(true);
    expect(
      newsDaySchema.safeParse(day('2026-09-17', [item({ brief: briefSchema.parse(brief) })]))
        .success,
    ).toBe(true);
  });

  it('have no place for an article body', () => {
    expect(newsItemSchema.safeParse({ ...item(), body: 'The full text' }).success).toBe(false);
    expect(newsItemSchema.safeParse({ ...item(), content: 'The full text' }).success).toBe(false);
    expect(
      newsItemSchema.safeParse(item({ excerpt: 'x'.repeat(EXCERPT_MAX_CHARS + 1) })).success,
    ).toBe(false);
  });

  it.each([
    ['a relative URL', { url: '/post' }],
    ['a script URL', { url: 'javascript:alert(1)' }],
    ['an id that is not a hash', { id: 'abc' }],
    ['a date without a time', { publishedAt: '2026-09-17' }],
    ['a negative score', { score: -1 }],
    ['fractional points', { points: 1.5 }],
    ['a topic that is not a slug', { topics: ['AI Agents'] }],
  ])('reject %s', (_name, overrides) => {
    expect(newsItemSchema.safeParse({ ...item(), ...overrides }).success).toBe(false);
  });

  it('hold the brief to its word limits', () => {
    expect(briefSchema.safeParse(brief).success).toBe(true);
    expect(briefSchema.safeParse({ ...brief, whatHappened: 'word '.repeat(61) }).success).toBe(
      false,
    );
    expect(briefSchema.safeParse({ ...brief, whyItMatters: 'word '.repeat(51) }).success).toBe(
      false,
    );
    expect(briefSchema.safeParse({ ...brief, keyConcepts: [brief.keyConcepts[0]] }).success).toBe(
      false,
    );
    expect(briefSchema.safeParse({ ...brief, readingLevel: 'medium' }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief, relatedLessons: ['Not An Id'] }).success).toBe(false);
  });

  it('keep provenance out of what the model may write', () => {
    const written = Object.fromEntries(
      Object.entries(brief).filter(([key]) => key !== 'generatedBy'),
    );
    expect(llmBriefSchema.safeParse(written).success).toBe(true);
    expect(llmBriefSchema.safeParse(brief).success).toBe(false);
  });

  it('reject a day on an impossible date', () => {
    expect(newsDaySchema.safeParse(day('2026-13-01', [])).success).toBe(false);
  });
});

describe('interestsSchema', () => {
  it('needs two glossary entries per topic, so the extractive brief can always be built', () => {
    const thin = {
      ...interests,
      glossary: interests.glossary.filter((entry) => entry.term !== 'XSS'),
    };
    const result = interestsSchema.safeParse(thin);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Topic "security" needs at least 2 glossary entries.',
    );
  });

  it('rejects a glossary entry filed under an unknown topic', () => {
    const stray = {
      ...interests,
      glossary: [
        ...interests.glossary,
        { term: 'Soil', match: [], explanation: 'Dirt.', topics: ['gardening'] },
      ],
    };
    expect(interestsSchema.safeParse(stray).error?.issues[0]?.message).toBe(
      'Glossary entry "Soil" names the unknown topic "gardening".',
    );
  });

  it('rejects a why sentence that would break the brief limit', () => {
    const wordy = {
      ...interests,
      topics: interests.topics.map((topic) => ({ ...topic, why: 'word '.repeat(51).trim() })),
    };
    expect(interestsSchema.safeParse(wordy).success).toBe(false);
  });
});
