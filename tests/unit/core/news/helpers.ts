import {
  interestsSchema,
  type Interests,
  type LessonIndexEntry,
  type NewsDay,
  type NewsItem,
} from '@/core/news';

export const NOW = new Date('2026-09-17T06:00:00Z');

/** A valid item with sensible defaults. Tests override only what they are about. */
export function item(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: '00000000000000aa',
    url: 'https://example.com/post',
    canonicalUrl: 'https://example.com/post',
    title: 'Postgres 19 ships asynchronous I/O',
    source: { id: 'postgres', name: 'PostgreSQL News', kind: 'feed' },
    publishedAt: '2026-09-17T00:00:00.000Z',
    fetchedAt: '2026-09-17T06:00:00.000Z',
    topics: [],
    score: 0,
    ...overrides,
  };
}

export const interests: Interests = interestsSchema.parse({
  halfLifeHours: 36,
  minScore: 0,
  weights: { topic: 1, source: 0.5, engagement: 0.5, recency: 1 },
  sourceWeights: {
    kinds: { hn: 0.5, arxiv: 0.4, feed: 0.6 },
    ids: { postgres: 0.9 },
  },
  blocked: {
    terms: ['bitcoin price', 'we are hiring', 'top 10'],
    domains: ['medium.com', 'spam.example'],
  },
  topics: [
    {
      id: 'ai-agents',
      label: 'AI engineering and agents',
      weight: 1,
      keywords: ['agent', 'agents', 'tool use', 'MCP', 'RAG'],
      why: 'Agents are moving from demos to production, and the failure modes are engineering problems.',
    },
    {
      id: 'databases',
      label: 'Postgres and databases',
      weight: 0.8,
      keywords: ['postgres', 'postgresql', 'sql', 'index'],
      why: 'Most applications are limited by their database, so changes here reach everyday work.',
    },
    {
      id: 'security',
      label: 'Security',
      weight: 0.6,
      keywords: ['vulnerability', 'xss', 'supply chain'],
      why: 'A flaw found elsewhere is often present in your own stack.',
    },
  ],
  glossary: [
    {
      term: 'Agent loop',
      match: ['agent', 'agents'],
      explanation:
        'A model that calls tools, reads the results and decides the next step until done.',
      topics: ['ai-agents'],
    },
    {
      term: 'RAG',
      match: ['retrieval-augmented'],
      explanation:
        'Retrieval-augmented generation: fetch relevant text first, then let the model answer from it.',
      topics: ['ai-agents'],
    },
    {
      term: 'Asynchronous I/O',
      match: ['async i/o'],
      explanation:
        'Issuing reads and writes without blocking, so the system overlaps waiting with other work.',
      topics: ['databases'],
    },
    {
      term: 'Index',
      match: ['b-tree'],
      explanation:
        'A sorted structure that lets the database find rows without scanning the table.',
      topics: ['databases'],
    },
    {
      term: 'Query planner',
      match: ['query plan'],
      explanation:
        'The part of a database that chooses how to execute a query from table statistics.',
      topics: ['databases'],
    },
    {
      term: 'XSS',
      match: ['cross-site scripting'],
      explanation: 'Injecting script into a page so it runs with the rights of the site.',
      topics: ['security'],
    },
    {
      term: 'Supply chain attack',
      match: ['supply chain'],
      explanation:
        'Compromising a dependency so that every project installing it runs hostile code.',
      topics: ['security'],
    },
  ],
});

export const lessonIndex: LessonIndexEntry[] = [
  { id: 'db.indexes', title: 'Indexes', keywords: ['index', 'b-tree', 'postgres'] },
  { id: 'db.explain', title: 'Reading EXPLAIN', keywords: ['query plan', 'explain'] },
  { id: 'ai.agents', title: 'Agents', keywords: ['agent', 'agents', 'mcp'] },
  { id: 'security.xss', title: 'XSS, CSP and security headers', keywords: ['xss', 'csp'] },
];

export function day(date: string, items: NewsItem[]): NewsDay {
  return {
    date,
    generatedAt: `${date}T05:30:00.000Z`,
    items,
    stats: {
      fetched: items.length,
      afterDedupe: items.length,
      excluded: 0,
      selected: items.length,
      llmBriefs: 0,
      extractiveBriefs: items.length,
      sources: [],
    },
  };
}
