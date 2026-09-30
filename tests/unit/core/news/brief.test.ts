import { describe, expect, it } from 'vitest';
import {
  briefSchema,
  extractiveBrief,
  relatedLessons,
  validateBrief,
  wordCount,
  type Brief,
} from '@/core/news';
import { interests, item, lessonIndex } from './helpers';

const pgItem = item({
  title: 'Postgres 19 ships asynchronous I/O',
  excerpt:
    'The release adds asynchronous I/O for sequential scans. Early benchmarks show faster reads on cloud storage. We are excited to share this! Upgrade notes follow.',
  topics: ['databases'],
});

describe('extractiveBrief', () => {
  const brief = extractiveBrief(pgItem, lessonIndex, interests);

  it('is schema-valid and passes its own validation', () => {
    expect(briefSchema.safeParse(brief).success).toBe(true);
    expect(validateBrief(brief, pgItem, lessonIndex)).toEqual({ ok: true });
  });

  it('is labelled as extractive and names no model', () => {
    expect(brief.generatedBy).toBe('extractive');
    expect(brief).not.toHaveProperty('model');
    expect(brief).not.toHaveProperty('recallCards');
  });

  it('builds what happened from the source, the title and the excerpt, and nothing else', () => {
    expect(brief.whatHappened).toBe(
      'PostgreSQL News published "Postgres 19 ships asynchronous I/O". The release adds asynchronous I/O for sequential scans. Early benchmarks show faster reads on cloud storage. Upgrade notes follow.',
    );
  });

  it('leaves out first-person and exclaiming sentences from the excerpt', () => {
    expect(brief.whatHappened).not.toMatch(/excited/);
  });

  it('takes why it matters from the primary topic', () => {
    expect(brief.whyItMatters).toBe(
      'Most applications are limited by their database, so changes here reach everyday work.',
    );
  });

  it('puts concepts named in the text first, then fills from the topic', () => {
    expect(brief.keyConcepts.map((concept) => concept.term)).toEqual(['Asynchronous I/O', 'Index']);
    const indexed = extractiveBrief(
      item({ title: 'A B-tree index and the query plan it enables', topics: ['databases'] }),
      lessonIndex,
      interests,
    );
    expect(indexed.keyConcepts.map((concept) => concept.term)).toEqual(['Index', 'Query planner']);
  });

  it('fills from concepts that belong to the topic first, not ones that only touch it', () => {
    const shared = {
      ...interests,
      glossary: [
        {
          term: 'Prompt injection',
          match: [],
          explanation: 'Instructions hidden in data the model reads.',
          topics: ['ai-agents', 'security'],
        },
        ...interests.glossary,
      ],
    };
    const quiet = extractiveBrief(
      item({ title: 'A quiet week', topics: ['security'] }),
      lessonIndex,
      shared,
    );
    expect(quiet.keyConcepts.map((concept) => concept.term)).toEqual([
      'XSS',
      'Supply chain attack',
    ]);
  });

  it('never lists more than four concepts', () => {
    const busy = extractiveBrief(
      item({
        title: 'Agents, RAG, a B-tree index, query plan, XSS and the supply chain',
        excerpt: 'Async I/O too.',
        topics: ['ai-agents'],
      }),
      lessonIndex,
      interests,
    );
    expect(busy.keyConcepts).toHaveLength(4);
  });

  it('links lessons by keyword', () => {
    expect(brief.relatedLessons).toEqual(['db.indexes']);
  });

  it('describes each kind of source honestly', () => {
    const hn = extractiveBrief(
      item({
        title: 'Show HN: A tiny agent runtime!',
        source: { id: 'hn', name: 'Hacker News', kind: 'hn' },
        points: 412,
        comments: 97,
        topics: ['ai-agents'],
      }),
      lessonIndex,
      interests,
    );
    expect(hn.whatHappened).toBe(
      '"Show HN: A tiny agent runtime" reached the Hacker News front page with 412 points and 97 comments.',
    );

    const paper = extractiveBrief(
      item({
        title: 'Agents that plan',
        source: { id: 'arxiv', name: 'arXiv', kind: 'arxiv' },
        authors: ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'],
        topics: ['ai-agents'],
      }),
      lessonIndex,
      interests,
    );
    expect(paper.whatHappened).toBe(
      'Ada Lovelace and 2 others posted the paper "Agents that plan" on arXiv.',
    );
    expect(paper.readingLevel).toBe('deep');
    expect(hn.readingLevel).toBe('quick');
  });

  it('stays inside the word limits however long the inputs are', () => {
    const long = extractiveBrief(
      item({
        title: 'word '.repeat(59).trim(),
        excerpt: `${'Many more words in a sentence that goes on. '.repeat(6)}`.slice(0, 280),
        topics: ['databases'],
      }),
      lessonIndex,
      interests,
    );
    expect(wordCount(long.whatHappened)).toBeLessThanOrEqual(60);
    expect(validateBrief(long, item(), lessonIndex).ok).toBe(true);
  });

  it('has a plain fallback when the item has no known topic', () => {
    const plain = extractiveBrief(item({ topics: [] }), lessonIndex, interests);
    expect(plain.whyItMatters).toBe('It matched your interests. The source does not say more.');
    expect(plain.keyConcepts.length).toBeGreaterThanOrEqual(2);
    expect(briefSchema.safeParse(plain).success).toBe(true);
  });
});

describe('relatedLessons', () => {
  it('ranks by keyword hits and caps the list', () => {
    const many = item({ title: 'An agent reads the query plan of a Postgres index via MCP' });
    expect(relatedLessons(many, lessonIndex)).toEqual(['ai.agents', 'db.indexes', 'db.explain']);
  });

  it('returns nothing when nothing matches', () => {
    expect(relatedLessons(item({ title: 'A quiet week' }), lessonIndex)).toEqual([]);
  });
});

describe('validateBrief', () => {
  const good: Brief = {
    whatHappened: 'PostgreSQL 19 adds asynchronous I/O for sequential scans.',
    whyItMatters: 'Reads on network storage get faster without application changes.',
    keyConcepts: [
      { term: 'Asynchronous I/O', explanation: 'Issuing reads without waiting for each one.' },
      { term: 'Sequential scan', explanation: 'Reading every row of a table in order.' },
    ],
    relatedLessons: ['db.indexes'],
    recallCards: [
      { front: 'What does asynchronous I/O overlap?', back: 'Waiting with other work.' },
    ],
    readingLevel: 'quick',
    generatedBy: 'llm',
    model: 'claude-test',
  };
  const problems = (brief: Brief) => {
    const result = validateBrief(brief, pgItem, lessonIndex);
    return result.ok ? [] : result.problems;
  };

  it('accepts a good brief', () => {
    expect(validateBrief(good, pgItem, lessonIndex)).toEqual({ ok: true });
  });

  it.each([
    ['whatHappened', 60],
    ['whyItMatters', 50],
  ] as const)('rejects %s over %i words', (field, limit) => {
    const over = { ...good, [field]: 'word '.repeat(limit + 1).trim() };
    expect(problems(over)).toEqual([`${field} has ${limit + 1} words, the limit is ${limit}.`]);
    const at = { ...good, [field]: 'word '.repeat(limit).trim() };
    expect(problems(at)).toEqual([]);
  });

  it('rejects a concept explanation over 30 words', () => {
    const over = {
      ...good,
      keyConcepts: [{ term: 'Long', explanation: 'word '.repeat(31).trim() }, good.keyConcepts[1]!],
    };
    expect(problems(over)).toEqual(['The explanation of "Long" has 31 words, the limit is 30.']);
  });

  it('rejects too few or too many concepts', () => {
    expect(problems({ ...good, keyConcepts: good.keyConcepts.slice(0, 1) })).toEqual([
      'keyConcepts has 1 entries, it needs 2 to 4.',
    ]);
    const five = Array.from({ length: 5 }, (_, i) => ({ term: `T${i}`, explanation: 'Fine.' }));
    expect(problems({ ...good, keyConcepts: five })).toEqual([
      'keyConcepts has 5 entries, it needs 2 to 4.',
    ]);
  });

  it('rejects more than two recall cards', () => {
    const card = { front: 'Q?', back: 'A.' };
    expect(problems({ ...good, recallCards: [card, card, card] })).toEqual([
      'recallCards has 3 entries, the limit is 2.',
    ]);
  });

  it('rejects a lesson that does not exist', () => {
    expect(problems({ ...good, relatedLessons: ['db.indexes', 'db.made-up'] })).toEqual([
      'relatedLessons names the unknown lesson "db.made-up".',
    ]);
  });

  it('rejects a URL that is not the item’s own', () => {
    const foreign = { ...good, whyItMatters: 'Read more at https://evil.example/offer today.' };
    expect(problems(foreign)).toEqual(['whyItMatters holds a URL that is not the item’s.']);
    const bare = { ...good, whyItMatters: 'Read more at www.evil.example today.' };
    expect(problems(bare)).toHaveLength(1);
  });

  it('allows the item’s own URLs', () => {
    const linked = item({ ...pgItem, discussionUrl: 'https://news.ycombinator.com/item?id=1' });
    const own = {
      ...good,
      whatHappened: 'See https://example.com/post and https://news.ycombinator.com/item?id=1.',
    };
    expect(validateBrief(own, linked, lessonIndex)).toEqual({ ok: true });
  });

  it.each([
    'I think this is big.',
    'We tested it.',
    'This changes our stack.',
    "It's my view.",
    'That surprised me.',
  ])('rejects first person: %s', (sentence) => {
    expect(problems({ ...good, whyItMatters: sentence })).toEqual([
      'whyItMatters is written in the first person.',
    ]);
  });

  it('does not mistake I/O, US or a quoted title for first person', () => {
    const fine = {
      ...good,
      whatHappened: 'The post "How I built our index" covers I/O limits in the US.',
    };
    expect(problems(fine)).toEqual([]);
  });

  it('rejects exclamation marks anywhere in the text', () => {
    const loud = { ...good, recallCards: [{ front: 'Ready?', back: 'Yes!' }] };
    expect(problems(loud)).toEqual(['recallCards holds an exclamation mark.']);
  });

  it('reports every problem at once', () => {
    const bad = {
      ...good,
      whatHappened: 'We love it!',
      relatedLessons: ['nope.nothing'],
    };
    expect(problems(bad)).toHaveLength(3);
  });
});
