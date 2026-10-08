import { describe, expect, it } from 'vitest';
import {
  draftFromBlock,
  parsePathBlock,
  plannerSituation,
  restoreCut,
  type Draft,
  type PlannerCourse,
} from '@/core/planner';

/* The Advisor's parts of a planned path (docs/SCOUT-ROLES.md, section 4). */

const lesson = (id: string) => ({
  id,
  title: `Title ${id}`,
  objective: `Do ${id}.`,
  level: 'essential' as const,
  minutes: 10,
  prerequisites: [],
});

const COURSE: PlannerCourse = {
  modules: [
    {
      id: 'web',
      number: 1,
      title: 'Web',
      summary: 'HTTP.',
      youCanBuild: 'An API.',
      lessons: [lesson('web.http'), lesson('web.rest'), lesson('web.graphql')],
    },
  ],
  parts: [],
};

const json = (value: unknown) => JSON.stringify(value);

const advised = {
  name: 'A small REST API',
  destination: 'Ship a small REST API with tests',
  baseline: 'Writes Python scripts, has never built a server.',
  cut: [
    { what: 'GraphQL', why: 'REST is enough for this API.', lessons: ['web.graphql', 'ghost'] },
    { what: 'Kubernetes', why: 'One small service needs none.', later: false },
  ],
  stages: [
    {
      title: 'HTTP',
      why: 'The ground.',
      lessons: ['web.http', 'web.graphql'],
      milestone: { output: 'A server that answers 404 on unknown routes', check: 'curl shows it' },
    },
    { title: 'REST', lessons: ['web.rest'] },
  ],
};

describe('the Advisor’s path block', () => {
  it('reads a destination, a baseline, a cutlist and milestones', () => {
    const block = parsePathBlock(json(advised));
    expect(block?.destination).toBe('Ship a small REST API with tests');
    expect(block?.cut?.[0]?.later).toBe(true);
    expect(block?.cut?.[1]).toMatchObject({ what: 'Kubernetes', later: false, lessons: [] });
    expect(block?.stages[0]?.milestone?.output).toMatch(/404/);
  });

  it('still reads a path without them', () => {
    const block = parsePathBlock(json({ name: 'Plain', stages: [{ title: 'A', lessons: [] }] }));
    expect(block?.destination).toBeUndefined();
    expect(block?.cut).toBeUndefined();
  });

  it('refuses a cutlist longer than eight', () => {
    const cut = Array.from({ length: 9 }, (_, i) => ({ what: `Topic ${i}`, why: 'Later.' }));
    expect(parsePathBlock(json({ ...advised, cut }))).toBeNull();
  });
});

describe('an advised draft', () => {
  const block = parsePathBlock(json(advised))!;
  const { draft, dropped } = draftFromBlock(block, COURSE);

  it('keeps the destination, the baseline and each stage’s milestone', () => {
    expect(draft.destination).toBe('Ship a small REST API with tests');
    expect(draft.baseline).toMatch(/never built a server/);
    expect(draft.stages[0]?.milestone).toEqual({
      output: 'A server that answers 404 on unknown routes',
      check: 'curl shows it',
    });
    expect(draft.stages[1]?.milestone).toBeUndefined();
  });

  it('keeps known lessons in the cutlist and takes them out of the stages', () => {
    expect(draft.cut?.[0]).toEqual({
      what: 'GraphQL',
      why: 'REST is enough for this API.',
      later: true,
      lessonIds: ['web.graphql'],
    });
    expect(draft.stages[0]?.lessonIds).toEqual(['web.http']);
    expect(dropped).toBe(1);
  });

  it('keeps a cut with no lessons, a topic the course does not teach', () => {
    expect(draft.cut?.[1]).toEqual({
      what: 'Kubernetes',
      why: 'One small service needs none.',
      later: false,
      lessonIds: [],
    });
  });

  it('gives a plain path an empty cutlist', () => {
    const plain = parsePathBlock(
      json({ name: 'Plain', stages: [{ title: 'A', lessons: ['web.http'] }] }),
    )!;
    expect(draftFromBlock(plain, COURSE).draft.cut).toEqual([]);
  });
});

describe('bringing a cut back', () => {
  const base: Draft = {
    name: 'API',
    alternatives: [],
    summary: '',
    cut: [
      { what: 'GraphQL', why: 'Later.', later: true, lessonIds: ['web.graphql', 'web.http'] },
      { what: 'Kubernetes', why: 'Not needed.', later: false, lessonIds: [] },
    ],
    stages: [{ title: 'HTTP', why: '', lessonIds: ['web.http'] }],
  };

  it('adds its lessons as a last stage and takes it off the cutlist', () => {
    const next = restoreCut(base, 0);
    expect(next.cut?.map((c) => c.what)).toEqual(['Kubernetes']);
    expect(next.stages.at(-1)).toEqual({
      title: 'GraphQL',
      why: 'Later.',
      lessonIds: ['web.graphql'],
    });
  });

  it('only takes a cut with no lessons off the list', () => {
    const next = restoreCut(base, 1);
    expect(next.cut?.map((c) => c.what)).toEqual(['GraphQL']);
    expect(next.stages).toHaveLength(1);
  });

  it('ignores an index that is not there', () => {
    expect(restoreCut(base, 5)).toBe(base);
  });
});

describe('what Scout sees of an advised draft', () => {
  it('lists the destination, the milestones and the cutlist', () => {
    const text = plannerSituation({
      today: '2026-10-08',
      done: [],
      lessons: 3,
      draft: {
        name: 'API',
        alternatives: [],
        summary: '',
        destination: 'Ship a small REST API',
        baseline: 'Writes scripts.',
        cut: [{ what: 'GraphQL', why: 'Later.', later: true, lessonIds: ['web.graphql'] }],
        stages: [
          {
            title: 'HTTP',
            why: '',
            lessonIds: ['web.http'],
            milestone: { output: 'A server that answers', check: 'curl' },
          },
        ],
      },
    });
    expect(text).toContain('Destination: Ship a small REST API.');
    expect(text).toContain('Baseline: Writes scripts.');
    expect(text).toContain('- HTTP: web.http. Milestone: A server that answers (check: curl).');
    expect(text).toContain('Left out for now: GraphQL (web.graphql), because Later.');
  });
});
