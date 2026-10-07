import { describe, expect, it } from 'vitest';
import {
  assumedByItem,
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

const item = (id: string, concept: string, extra: Record<string, unknown> = {}) => ({
  type: 'multiple-choice' as const,
  id,
  concept,
  difficulty: 2,
  question: 'Which one?',
  choices: [
    { text: 'This', correct: true, feedback: 'Yes.' },
    { text: 'That', feedback: 'No.' },
  ],
  ...extra,
});

/** A module whose four items test the given concepts, core first. */
const mod = (id: string, concepts: [string, string, string, string]) => ({
  id,
  core: concepts.slice(0, 2).map((c, i) => item(`${id}-core-${i}`, c)),
  deep: concepts.slice(2).map((c, i) => item(`${id}-deep-${i}`, c)),
});

describe('assumedByItem', () => {
  it('assumes the lessons that teach what the item tests, and nothing else', () => {
    expect(assumedByItem({ concept: 'web.d' }, ['web', 'api'], lessons)).toEqual([
      'web.d',
      'web.e',
    ]);
  });

  it('adds the lessons of the concepts named in also', () => {
    expect(
      assumedByItem({ concept: 'web.a', also: ['web.c'] }, ['web', 'api'], lessons),
    ).toEqual(['web.a', 'web.b', 'web.c', 'api.a']);
  });

  it('leaves out lessons and concepts outside the area', () => {
    expect(assumedByItem({ concept: 'web.a' }, ['web'], lessons)).not.toContain('other.a');
  });
});

describe('placementFileSchema', () => {
  it('needs exactly two core and two deep questions in a module', () => {
    const short = { ...mod('web', ['web.a', 'web.b', 'web.c', 'web.d']), deep: [] };
    const parsed = placementFileSchema.safeParse({
      schema: 3,
      areas: [{ id: 'site', title: 'The site', quick: ['web', 'api'], modules: [short] }],
      paths: [],
    });
    expect(parsed.success).toBe(false);
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
  const file = (extra: Partial<PlacementFile> = {}): PlacementFile =>
    placementFileSchema.parse({
      schema: 3,
      areas: [
        {
          id: 'site',
          title: 'The site',
          part: 'site',
          quick: ['web', 'api'],
          modules: [
            mod('web', ['web.a', 'web.c', 'web.d', 'web.b']),
            mod('api', ['api.a', 'api.a', 'api.a', 'api.a']),
          ],
        },
      ],
      paths: [{ area: 'site', below: 2, path: 'web-basics' }],
      ...extra,
    });
  const rules = (f: PlacementFile) => checkPlacement(f, world, 'p.yaml').map((i) => i.rule);

  it('accepts a sound file, and warns about modules no area asks about', () => {
    expect(rules(file())).toEqual(['placement-module-unplaced']);
  });

  it('rejects two items with one id', () => {
    const f = file();
    const web = f.areas[0]!.modules[0]!;
    web.deep[0] = { ...web.deep[0]!, id: web.core[0]!.id };
    expect(rules(f)).toContain('placement-item-id-reused');
  });

  it('rejects a concept that is unknown, in another module, off the area or untaught', () => {
    const f = file();
    const web = f.areas[0]!.modules[0]!;
    web.core[0] = { ...web.core[0]!, concept: 'web.zz' };
    web.core[1] = { ...web.core[1]!, concept: 'api.a' };
    web.deep[0] = { ...web.deep[0]!, also: ['other.a'] };
    web.deep[1] = { ...web.deep[1]!, concept: 'web.f' };
    expect(rules(f)).toEqual(
      expect.arrayContaining([
        'placement-concept-unknown',
        'placement-concept-off-module',
        'placement-concept-off-area',
        'placement-concept-untaught',
      ]),
    );
  });

  it('accepts also from another module of the same area', () => {
    const f = file();
    const web = f.areas[0]!.modules[0]!;
    web.core[0] = { ...web.core[0]!, also: ['api.a'] };
    expect(rules(f)).toEqual(['placement-module-unplaced']);
  });

  it('rejects a quick check that names a module outside the area, or one twice', () => {
    const f = file();
    f.areas[0]!.quick = ['web', 'nowhere'];
    expect(rules(f)).toContain('placement-quick-unknown');
    f.areas[0]!.quick = ['web', 'web'];
    expect(rules(f)).toContain('placement-quick-twice');
  });

  it('rejects unknown paths, parts and rule areas', () => {
    const f = file({ paths: [{ area: 'nowhere', below: 2, path: 'missing' }] });
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
