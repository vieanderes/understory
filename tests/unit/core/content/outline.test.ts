import { describe, expect, it } from 'vitest';
import type { Issue, RawCatalog } from '@/core/content/catalog';
import {
  journeyOrder,
  orderOfDir,
  OUTLINE_PATH,
  outlineEntries,
  outlineSchema,
  slugOfDir,
} from '@/core/content/outline';
import type { Outline, OutlineLesson, RawOutline } from '@/core/content/outline';
import { OUTLINE_RULE_LIST, validateOutline } from '@/core/content/validate';
import { lessonOf, moduleOf, rawModule, validCatalog } from './fixtures';

/** The plan that matches the fixture catalog: one module, its one published lesson, one planned. */
function validOutlineInput(): Record<string, unknown> {
  return {
    modules: [
      {
        id: 'js',
        dir: '03-javascript',
        lessons: [
          {
            id: 'js.coercion',
            dir: '01-coercion',
            title: 'Values, types and coercion',
            objective: 'Predict the result of `+` on mixed types.',
            level: 'essential',
            concepts: ['js.coercion', 'js.equality'],
          },
          {
            id: 'js.closures',
            dir: '02-scope-and-closures',
            title: 'Variables, scope and closures',
            objective: 'Trace which binding a function sees.',
            level: 'essential',
            concepts: ['js.coercion', 'js.equality'],
            lab: 'event-loop-stepper',
          },
        ],
      },
    ],
  };
}

const validOutline = (): RawOutline => ({
  path: OUTLINE_PATH,
  data: outlineSchema.parse(validOutlineInput()),
});

interface World {
  catalog: RawCatalog;
  outline: Outline;
  interests: string[];
}

/** Builds the valid world, lets the test break one thing, and returns the issues. */
function issuesAfter(mutate: (world: World) => void): Issue[] {
  const raw = validOutline();
  const world: World = { catalog: validCatalog(), outline: raw.data, interests: ['js.closures'] };
  mutate(world);
  return validateOutline({
    catalog: world.catalog,
    outline: { ...raw, data: world.outline },
    interestLessonIds: world.interests,
  });
}

const lessonAt = (outline: Outline, position: number): OutlineLesson => {
  const lesson = outline.modules[0]?.lessons[position];
  if (!lesson) throw new Error(`The fixture outline has no lesson at ${position}.`);
  return lesson;
};

const rulesOf = (issues: Issue[]) => issues.map((issue) => issue.rule);
const only = (issues: Issue[], rule: string): Issue => {
  const found = issues.find((issue) => issue.rule === rule);
  if (!found) throw new Error(`expected an issue for ${rule}, got: ${rulesOf(issues).join(', ')}`);
  return found;
};

describe('outlineSchema', () => {
  it('accepts the valid outline', () => {
    expect(outlineSchema.safeParse(validOutlineInput()).success).toBe(true);
  });

  it.each([
    ['one concept', (lesson: Record<string, unknown>) => (lesson.concepts = ['js.coercion'])],
    ['five concepts', (lesson: Record<string, unknown>) => (lesson.concepts = Array(5).fill('js.coercion'))],
    ['a folder with no number', (lesson: Record<string, unknown>) => (lesson.dir = 'coercion')],
    ['an id with no dot', (lesson: Record<string, unknown>) => (lesson.id = 'coercion')],
    ['an unknown level', (lesson: Record<string, unknown>) => (lesson.level = 'beginner')],
    ['an unknown key', (lesson: Record<string, unknown>) => (lesson.minutes = 20)],
    ['a lab id with capitals', (lesson: Record<string, unknown>) => (lesson.lab = 'EventLoop')],
  ])('rejects %s', (_name, mutate) => {
    const input = validOutlineInput() as { modules: { lessons: Record<string, unknown>[] }[] };
    const lesson = input.modules[0]?.lessons[0];
    if (lesson) mutate(lesson);
    expect(outlineSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a module with no lessons and an outline with no modules', () => {
    expect(outlineSchema.safeParse({ modules: [] }).success).toBe(false);
    expect(
      outlineSchema.safeParse({ modules: [{ id: 'js', dir: '03-javascript', lessons: [] }] }).success,
    ).toBe(false);
  });
});

describe('outline helpers', () => {
  it('reads the slug and the order from a folder name', () => {
    expect(slugOfDir('03-javascript')).toBe('javascript');
    expect(orderOfDir('03-javascript')).toBe(3);
    expect(OUTLINE_PATH).toBe('content/course/outline.yaml');
  });

  it('lists every planned lesson with its module', () => {
    const entries = outlineEntries(validOutline().data);
    expect(entries.map(({ module, lesson }) => `${module.id}:${lesson.id}`)).toEqual([
      'js:js.coercion',
      'js:js.closures',
    ]);
  });
});

describe('journeyOrder', () => {
  const lesson = (id: string, wovenAfter?: string) => ({
    id,
    dir: '01-x',
    title: 'T',
    objective: 'Do it.',
    level: 'essential',
    concepts: ['a.b', 'a.c'],
    ...(wovenAfter === undefined ? {} : { wovenAfter }),
  });
  const outlineOf = (...modules: [string, ReturnType<typeof lesson>[]][]): Outline =>
    outlineSchema.parse({
      modules: modules.map(([id, lessons], i) => ({ id, dir: `0${i}-${id}`, lessons })),
    });
  const ids = (outline: Outline) => journeyOrder(outline).map((entry) => entry.lesson.id);

  it('keeps file order when nothing is woven', () => {
    expect(ids(validOutline().data)).toEqual(['js.coercion', 'js.closures']);
  });

  it('moves a woven lesson to just after its target', () => {
    const outline = outlineOf(
      ['js', [lesson('js.one'), lesson('js.two')]],
      ['cs', [lesson('cs.big-o', 'js.one')]],
    );
    expect(ids(outline)).toEqual(['js.one', 'cs.big-o', 'js.two']);
  });

  it('keeps file order among lessons woven after the same target, and follows chains', () => {
    const outline = outlineOf(
      ['js', [lesson('js.one'), lesson('js.two')]],
      ['cs', [lesson('cs.a', 'js.one'), lesson('cs.b', 'js.one'), lesson('cs.c', 'cs.a')]],
    );
    expect(ids(outline)).toEqual(['js.one', 'cs.a', 'cs.c', 'cs.b', 'js.two']);
  });

  it('leaves a lesson in place when its target is missing or is itself', () => {
    const outline = outlineOf(['cs', [lesson('cs.a', 'js.nowhere'), lesson('cs.b', 'cs.b')]]);
    expect(ids(outline)).toEqual(['cs.a', 'cs.b']);
  });

  it('never drops the lessons of a wovenAfter cycle', () => {
    const outline = outlineOf(['cs', [lesson('cs.a', 'cs.b'), lesson('cs.b', 'cs.a'), lesson('cs.c')]]);
    expect(ids(outline).sort()).toEqual(['cs.a', 'cs.b', 'cs.c']);
  });
});

describe('validateOutline', () => {
  it('has nothing to say about the valid fixture', () => {
    expect(issuesAfter(() => undefined)).toEqual([]);
  });

  it('checks nothing but confusableWith when there is no outline', () => {
    const issues = validateOutline({ catalog: validCatalog(), interestLessonIds: ['x.y'] });
    expect(issues).toEqual([]);
  });

  it('outline-duplicate-id: a lesson id is planned twice', () => {
    const issues = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).id = 'js.coercion';
    });
    const issue = only(issues, 'outline-duplicate-id');
    expect(issue.path).toBe('content/course/outline.yaml');
    expect(issue.message).toContain('js.coercion');
  });

  it('outline-duplicate-id: a module id appears twice', () => {
    const issues = issuesAfter(({ outline }) => {
      const first = outline.modules[0];
      if (first) outline.modules.push({ ...first, dir: '04-typescript', lessons: [] });
    });
    expect(only(issues, 'outline-duplicate-id').message).toContain('module id "js"');
  });

  it('outline-duplicate-dir: two lessons of a module share a folder', () => {
    const issues = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).dir = '01-coercion';
    });
    expect(only(issues, 'outline-duplicate-dir')).toMatchObject({ where: 'js', severity: 'error' });
  });

  it('outline-duplicate-dir: two modules share a folder', () => {
    const issues = issuesAfter(({ outline }) => {
      const first = outline.modules[0];
      if (first) outline.modules.push({ ...first, id: 'ts', lessons: [] });
    });
    expect(only(issues, 'outline-duplicate-dir').message).toContain('03-javascript');
  });

  it('outline-dir-order: a lesson folder is not numbered by its place', () => {
    const issues = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).dir = '05-scope-and-closures';
    });
    const issue = only(issues, 'outline-dir-order');
    expect(issue.where).toBe('js.closures');
    expect(issue.message).toContain('"02-"');
  });

  it('outline-lesson-id-prefix: a lesson id does not start with its module id', () => {
    const issues = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).id = 'ts.closures';
    });
    expect(only(issues, 'outline-lesson-id-prefix').message).toContain('"js."');
  });

  it('outline-module-unknown: no module.yaml has the planned id', () => {
    const issues = issuesAfter(({ outline }) => {
      outline.modules.push({ id: 'ts', dir: '04-typescript', lessons: [] });
    });
    expect(only(issues, 'outline-module-unknown').message).toContain('04-typescript/module.yaml');
  });

  it('outline-module-unknown: the module.yaml sits in another folder', () => {
    const issues = issuesAfter(({ catalog }) => {
      moduleOf(catalog).slug = 'js';
    });
    expect(only(issues, 'outline-module-unknown').message).toContain('"03-js"');
  });

  it('outline-concept-unknown: a planned lesson names a concept no module defines', () => {
    const issues = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).concepts = ['js.coercion', 'js.nowhere'];
    });
    expect(only(issues, 'outline-concept-unknown')).toMatchObject({
      where: 'js.closures',
      path: 'content/course/outline.yaml',
    });
  });

  it('outline-concept-foreign: a planned lesson lists a concept of another module', () => {
    const issues = issuesAfter(({ catalog, outline }) => {
      const other = rawModule([]);
      other.path = 'content/course/02-css/module.yaml';
      other.slug = 'css';
      other.order = 2;
      other.data.id = 'css';
      other.data.number = 2;
      other.data.concepts = [{ id: 'css.cascade', title: 'Cascade', summary: 'Which rule wins.' }];
      catalog.course?.modules.push(other);
      lessonAt(outline, 1).concepts = ['js.coercion', 'css.cascade'];
    });
    expect(only(issues, 'outline-concept-foreign').message).toContain('"css"');
    // The css module is not planned in this outline, so its unused concept is not reported.
    expect(rulesOf(issues)).not.toContain('outline-concept-unused');
  });

  it('outline-concept-unused: a module concept is taught by no planned lesson (warning)', () => {
    const issues = issuesAfter(({ catalog }) => {
      moduleOf(catalog).data.concepts.push({ id: 'js.scope', title: 'Scope', summary: 'Where a name resolves.' });
    });
    expect(only(issues, 'outline-concept-unused')).toMatchObject({
      severity: 'warning',
      path: 'content/course/03-javascript/module.yaml',
      where: 'js.scope',
    });
  });

  it('outline-woven-unknown: wovenAfter names no planned lesson, or the lesson itself', () => {
    const missing = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).wovenAfter = 'js.nowhere';
    });
    expect(only(missing, 'outline-woven-unknown').message).toContain('js.nowhere');
    const self = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).wovenAfter = 'js.closures';
    });
    expect(rulesOf(self)).toContain('outline-woven-unknown');
    const fine = issuesAfter(({ outline }) => {
      lessonAt(outline, 1).wovenAfter = 'js.coercion';
    });
    expect(fine).toEqual([]);
  });

  it('outline-lesson-unplanned: a published lesson id is not in the outline', () => {
    const issues = issuesAfter(({ catalog }) => {
      lessonOf(catalog).data.id = 'js.types';
    });
    const issue = only(issues, 'outline-lesson-unplanned');
    expect(issue.path).toBe('content/course/03-javascript/01-coercion/lesson.yaml');
    expect(issue.message).toContain('js.types');
  });

  it('outline-lesson-dir: a published lesson sits in another folder than planned', () => {
    const issues = issuesAfter(({ outline }) => {
      lessonAt(outline, 0).dir = '01-values-types-coercion';
    });
    const issue = only(issues, 'outline-lesson-dir');
    expect(issue.message).toContain('"03-javascript/01-coercion"');
    expect(issue.message).toContain('"03-javascript/01-values-types-coercion"');
  });

  it('checks the lessons of every module in the course against the one outline', () => {
    const issues = issuesAfter(({ catalog }) => {
      const data = lessonOf(catalog).data;
      const lesson = { ...lessonOf(catalog), data: { ...data, id: 'css.cascade' } };
      lesson.path = 'content/course/02-css/01-cascade/lesson.yaml';
      const other = rawModule([lesson]);
      other.path = 'content/course/02-css/module.yaml';
      other.slug = 'css';
      other.order = 2;
      other.data.id = 'css';
      other.data.number = 2;
      other.data.concepts = [{ id: 'css.cascade', title: 'Cascade', summary: 'Which rule wins.' }];
      catalog.course?.modules.push(other);
    });
    expect(only(issues, 'outline-lesson-unplanned').path).toBe(
      'content/course/02-css/01-cascade/lesson.yaml',
    );
  });

  it('confusable-asymmetric: a concept is not listed back', () => {
    const issues = issuesAfter(({ catalog }) => {
      const [coercion] = moduleOf(catalog).data.concepts;
      if (coercion) coercion.confusableWith = ['js.equality'];
    });
    const issue = only(issues, 'confusable-asymmetric');
    expect(issue).toMatchObject({ where: 'js.coercion', path: 'content/course/03-javascript/module.yaml' });
  });

  it('confusable-asymmetric: a symmetric pair is fine, and an unknown target is left to its own rule', () => {
    const issues = issuesAfter(({ catalog }) => {
      const [coercion, equality] = moduleOf(catalog).data.concepts;
      if (coercion) coercion.confusableWith = ['js.equality', 'js.nowhere'];
      if (equality) equality.confusableWith = ['js.coercion'];
    });
    expect(rulesOf(issues)).not.toContain('confusable-asymmetric');
  });

  it('interests-lesson-unknown: the lesson index names an id no outline plans', () => {
    const issues = issuesAfter((world) => {
      world.interests = ['js.closures', 'devops.backups'];
    });
    const issue = only(issues, 'interests-lesson-unknown');
    expect(issue).toMatchObject({ path: 'content/interests.yaml', where: 'devops.backups' });
    expect(issues).toHaveLength(1);
  });
});

describe('OUTLINE_RULE_LIST', () => {
  it('lists every outline rule, so this file stays complete', () => {
    // Adding a rule means adding it here, and a test for it above.
    expect(OUTLINE_RULE_LIST.map((entry) => entry.rule).sort()).toEqual([
      'confusable-asymmetric',
      'interests-lesson-unknown',
      'outline-concept-foreign',
      'outline-concept-unknown',
      'outline-concept-unused',
      'outline-dir-order',
      'outline-duplicate-dir',
      'outline-duplicate-id',
      'outline-lesson-dir',
      'outline-lesson-id-prefix',
      'outline-lesson-unplanned',
      'outline-module-unknown',
      'outline-woven-unknown',
      'part-duplicate-id',
      'part-id-clash',
      'part-module-missing',
      'part-module-order',
      'part-module-repeated',
      'part-module-unknown',
      'part-module-woven',
    ]);
    const warnings = OUTLINE_RULE_LIST.filter((entry) => entry.severity === 'warning');
    expect(warnings.map((entry) => entry.rule)).toEqual(['outline-concept-unused']);
  });
});
