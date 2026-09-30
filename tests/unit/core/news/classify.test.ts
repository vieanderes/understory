import { describe, expect, it } from 'vitest';
import { classify } from '@/core/news';
import { interests, item } from './helpers';

describe('classify', () => {
  it('assigns a topic when a keyword appears in the title', () => {
    expect(classify(item({ title: 'A faster index for Postgres' }), interests)).toEqual([
      'databases',
    ]);
  });

  it('reads the excerpt as well', () => {
    const topics = classify(
      item({ title: 'Release notes', excerpt: 'Fixes an XSS vulnerability in the admin page.' }),
      interests,
    );
    expect(topics).toEqual(['security']);
  });

  it('matches whole words only', () => {
    // "storage" contains "rag" and "reagent" contains "agent".
    expect(classify(item({ title: 'Cheaper storage for every reagent' }), interests)).toEqual([]);
  });

  it('matches without regard to case, and phrases with spaces', () => {
    expect(classify(item({ title: 'TOOL USE in small models' }), interests)).toEqual(['ai-agents']);
    expect(classify(item({ title: 'What mcp gets wrong' }), interests)).toEqual(['ai-agents']);
  });

  it('orders topics by strength: keyword hits times topic weight', () => {
    const topics = classify(
      item({
        title: 'Agents that write SQL',
        excerpt: 'An agent plans the index, then runs sql against postgres.',
      }),
      interests,
    );
    expect(topics).toEqual(['databases', 'ai-agents']);
  });

  it('counts a title hit more than an excerpt hit', () => {
    const topics = classify(
      item({ title: 'A new agent framework', excerpt: 'It talks to postgres.' }),
      interests,
    );
    expect(topics[0]).toBe('ai-agents');
  });

  it('keeps the hints a feed carries, after any keyword matches', () => {
    expect(classify(item({ title: 'A quiet week', topics: ['security'] }), interests)).toEqual([
      'security',
    ]);
    expect(classify(item({ title: 'Agents everywhere', topics: ['security'] }), interests)).toEqual(
      ['ai-agents', 'security'],
    );
  });

  it('drops hints that name no known topic', () => {
    expect(classify(item({ title: 'A quiet week', topics: ['gardening'] }), interests)).toEqual([]);
  });
});
