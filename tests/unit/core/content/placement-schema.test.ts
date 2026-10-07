import { describe, expect, it } from 'vitest';
import {
  assumedByLevel,
  checkPlacement,
  placementFileSchema,
  type PlacementFile,
  type PlacementWorld,
} from '@/core/content/placement-schema';

const lessons = [
  { moduleId: 'web', concepts: ['web.a', 'web.b'] },
  { moduleId: 'web', concepts: ['web.c'] },
  { moduleId: 'web', concepts: ['web.d', 'web.e'] },
  { moduleId: 'api', concepts: ['api.a', 'web.c'] },
  { moduleId: 'other', concepts: ['other.a', 'web.a'] },
];

const item = (id: string, concept: string, correct = true) => ({
  type: 'multiple-choice' as const,
  id,
  concept,
  difficulty: 2,
  question: 'Which one?',
  choices: [
    { text: 'This', correct, feedback: 'Yes.' },
    { text: 'That', feedback: 'No.' },
  ],
});

const area = (levels: string[][]) => ({
  id: 'site',
  title: 'The site',
  modules: ['web', 'api'],
  levels: levels.map((concepts, i) => ({
    level: i + 1,
    items: concepts.map((c, j) => item(`site-${i + 1}-${j}`, c)),
  })),
});

describe('assumedByLevel', () => {
  it('assumes the lessons the items come from, and nothing else', () => {
    expect(assumedByLevel(area([['web.a'], ['web.d'], ['api.a']]), lessons)).toEqual([
      ['web.a', 'web.b'],
      ['web.d', 'web.e'],
      ['api.a', 'web.c'],
    ]);
  });

  it('never repeats a concept a lower level assumed', () => {
    expect(assumedByLevel(area([['web.c'], ['api.a'], ['web.b']]), lessons)).toEqual([
      ['web.c', 'api.a'],
      [],
      ['web.a', 'web.b'],
    ]);
  });

  it('leaves out lessons and concepts outside the area', () => {
    const [first] = assumedByLevel(area([['web.a'], [], []]), lessons);
    expect(first).not.toContain('other.a');
  });
});

describe('checkPlacement', () => {
  const world: PlacementWorld = {
    modules: [
      { id: 'web', concepts: ['web.a', 'web.b', 'web.c', 'web.d', 'web.e', 'web.f'] },
      { id: 'api', concepts: ['api.a'] },
      { id: 'other', concepts: ['other.a'] },
    ],
    lessons,
    parts: ['site'],
    paths: ['web-basics'],
  };
  const file = (levels: string[][], extra: Partial<PlacementFile> = {}): PlacementFile =>
    placementFileSchema.parse({
      schema: 2,
      areas: [area(levels)],
      paths: [{ area: 'site', below: 2, path: 'web-basics' }],
      ...extra,
    });
  const three = ['web.a', 'web.b', 'web.c'];
  const rules = (f: PlacementFile) => checkPlacement(f, world, 'p.yaml').map((i) => i.rule);

  it('accepts a sound file, and warns about modules no area speaks for', () => {
    const sound = file([three, ['web.d', 'web.e', 'api.a'], ['web.a', 'web.c', 'web.d']]);
    expect(rules(sound)).toEqual(['placement-module-unplaced']);
  });

  it('rejects two items with one id', () => {
    const f = file([three, ['web.d', 'web.e', 'api.a'], ['web.a', 'web.c', 'web.d']]);
    const level = f.areas[0]!.levels[1]!;
    level.items[1] = { ...level.items[1]!, id: level.items[0]!.id };
    expect(rules(f)).toContain('placement-item-id-reused');
  });

  it('rejects an item concept that is unknown, off the area or taught by no lesson', () => {
    const f = file([
      ['web.zz', 'other.a', 'web.f'],
      ['web.d', 'web.e', 'api.a'],
      ['web.a', 'web.c', 'web.d'],
    ]);
    expect(rules(f)).toEqual(
      expect.arrayContaining([
        'placement-concept-unknown',
        'placement-concept-off-area',
        'placement-concept-untaught',
      ]),
    );
  });

  it('rejects unknown paths, parts and rule areas', () => {
    const f = file([three, ['web.d', 'web.e', 'api.a'], ['web.a', 'web.c', 'web.d']], {
      paths: [{ area: 'nowhere', below: 2, path: 'missing' }],
    });
    const bad = { ...f, areas: f.areas.map((a) => ({ ...a, part: 'nopart' })) };
    expect(rules(bad)).toEqual(
      expect.arrayContaining([
        'placement-rule-area-unknown',
        'placement-rule-path-unknown',
        'placement-part-unknown',
      ]),
    );
  });
});
