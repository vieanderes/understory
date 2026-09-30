import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { courseSchema, lessonSchema } from '@/core/content/schema';
import {
  ContentError,
  describeIssues,
  listNumbered,
  loadRawCatalog,
  parseNumbered,
  readYaml,
} from '@/lib/content/fs';
import { validLessonInput } from '../../core/content/fixtures';
import { fixtureTree, LESSON_DIR, makeRoot, removeRoot } from './helpers';

const roots: string[] = [];
const rootWith = (changes: Record<string, string | undefined> = {}): string => {
  const tree = fixtureTree();
  for (const [rel, contents] of Object.entries(changes)) {
    if (contents === undefined) delete tree[rel];
    else tree[rel] = contents;
  }
  const root = makeRoot(tree);
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

describe('parseNumbered', () => {
  it('splits the NN- prefix from the slug', () => {
    expect(parseNumbered('03-javascript')).toEqual({ order: 3, slug: 'javascript' });
    expect(parseNumbered('10-the-event-loop')).toEqual({ order: 10, slug: 'the-event-loop' });
  });

  it.each(['javascript', '3-javascript', '03-JavaScript', '03_javascript', '03-'])(
    'rejects %s',
    (name) => expect(parseNumbered(name)).toBeUndefined(),
  );
});

describe('listNumbered', () => {
  it('lists numbered folders in order and reports the rest', () => {
    const root = rootWith({
      'content/course/00-orientation/module.yaml': 'x: 1',
      'content/course/Drafts/module.yaml': 'x: 1',
    });
    const { entries, issues } = listNumbered(root, 'content/course');
    expect(entries.map((entry) => entry.name)).toEqual(['00-orientation', '03-javascript']);
    expect(entries[1]).toMatchObject({ order: 3, slug: 'javascript' });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'folder-name', path: 'content/course/Drafts' });
    expect(issues[0]?.message).toContain('03-javascript');
  });
});

describe('readYaml', () => {
  it('returns the parsed, validated data', () => {
    const root = rootWith();
    expect(readYaml('course/course.yaml', courseSchema, root).title).toBe('The course');
  });

  it('throws a ContentError that names the file when it is missing', () => {
    const root = rootWith();
    expect(() => readYaml('course/nope.yaml', courseSchema, root)).toThrowError(ContentError);
    expect(() => readYaml('course/nope.yaml', courseSchema, root)).toThrowError(
      /content\/course\/nope\.yaml[\s\S]*missing/,
    );
  });

  it('throws a ContentError with the friendly schema message', () => {
    const root = rootWith({ 'content/course/course.yaml': 'tittle: The course\nsummary: x\n' });
    expect(() => readYaml('course/course.yaml', courseSchema, root)).toThrowError(
      /Unknown key "tittle"/,
    );
  });
});

describe('describeIssues', () => {
  const describeLesson = (input: unknown) => {
    const result = lessonSchema.safeParse(input);
    if (result.success) throw new Error('expected the input to be invalid');
    return describeIssues(result.error.issues, { schema: lessonSchema, data: input });
  };

  it('names an unknown key and lists the keys allowed there', () => {
    const [issue] = describeLesson({ ...validLessonInput(), tittle: 'x' });
    expect(issue?.message).toContain('Unknown key "tittle"');
    expect(issue?.message).toContain('title');
  });

  it('says "missing" with the hint from .describe()', () => {
    const input = validLessonInput();
    delete input.objective;
    const [issue] = describeLesson(input);
    expect(issue?.message).toBe(
      'Missing "objective". What the learner can do afterwards, starting with a verb.',
    );
  });

  it('finds the hint through arrays and the step union, and names the step', () => {
    const input = validLessonInput();
    const steps = input.steps as Record<string, unknown>[];
    delete steps[1]?.question;
    const [issue] = describeLesson(input);
    expect(issue?.where).toBe('steps → 2 (predict-total) → question');
    expect(issue?.message).toContain('What the learner predicts');
  });

  it('lists the step types when "type" is wrong', () => {
    const input = validLessonInput();
    (input.steps as Record<string, unknown>[])[0] = { type: 'quiz', id: 'x' };
    const [issue] = describeLesson(input);
    expect(issue?.message).toContain('"type" must be one of');
    expect(issue?.message).toContain('predict-output');
  });

  it('explains a wrong type in words', () => {
    const [issue] = describeLesson({ ...validLessonInput(), minutes: 'twelve' });
    expect(issue?.message).toContain('must be a number');
  });

  it('explains list sizes in words', () => {
    const input = validLessonInput();
    input.recall = [];
    const [issue] = describeLesson(input);
    expect(issue?.message).toContain('at least 3');
  });

  it('explains number ranges in words', () => {
    const [issue] = describeLesson({ ...validLessonInput(), minutes: 240 });
    expect(issue?.message).toContain('at most 180');
  });

  it('lists the options of an enum', () => {
    const [issue] = describeLesson({ ...validLessonInput(), level: 'expert' });
    expect(issue?.message).toContain('"essential"');
    expect(issue?.message).toContain('"advanced"');
  });

  it('works without a schema, with less detail', () => {
    const result = z.strictObject({ a: z.string() }).safeParse({});
    expect(describeIssues(result.error?.issues ?? [])[0]?.message).toBe('Missing "a".');
  });
});

describe('loadRawCatalog', () => {
  it('reads the course, its modules and lessons, in folder order', () => {
    const root = rootWith({
      'content/course/00-orientation/module.yaml':
        'id: orientation\nnumber: 0\ntitle: Orientation\nsummary: Start here.\nwhy: Start here.\nyouCanBuild: A repo.\nconcepts:\n  - id: orientation.git\n    title: Git\n    summary: A graph of commits.\n',
    });
    const { catalog, issues, checked } = loadRawCatalog(root);
    expect(issues).toEqual([]);
    expect(checked).toBe(4);
    const { course } = catalog;
    expect(course).toMatchObject({ path: 'content/course/course.yaml' });
    expect(course?.data.title).toBe('The course');
    expect(course?.modules.map((m) => m.slug)).toEqual(['orientation', 'javascript']);
    const lesson = course?.modules[1]?.lessons[0];
    expect(lesson).toMatchObject({ slug: 'coercion', order: 1, path: `${LESSON_DIR}/lesson.yaml` });
    expect(lesson?.data.id).toBe('js.coercion');
  });

  it('resolves the sibling files of a code challenge into strings', () => {
    const { catalog } = loadRawCatalog(rootWith());
    const files = catalog.course?.modules[0]?.lessons[0]?.files ?? {};
    expect(Object.keys(files).sort()).toEqual(['solution.ts', 'starter.ts', 'tests.ts']);
    expect(files['tests.ts']).toContain("from './solution'");
  });

  it('leaves a missing sibling file out, for the validator to report', () => {
    const { catalog, issues } = loadRawCatalog(rootWith({ [`${LESSON_DIR}/solution.ts`]: undefined }));
    expect(issues).toEqual([]);
    expect(catalog.course?.modules[0]?.lessons[0]?.files).not.toHaveProperty('solution.ts');
  });

  it('never reads a file outside the lesson folder', () => {
    const lesson = validLessonInput();
    const challenge = (lesson.steps as Record<string, unknown>[]).find(
      (step) => step.type === 'code-challenge',
    );
    if (challenge) challenge.solution = '../module.yaml';
    // JSON is YAML, which saves a second serialiser in the test.
    const root = rootWith({ [`${LESSON_DIR}/lesson.yaml`]: JSON.stringify(lesson) });
    const files = loadRawCatalog(root).catalog.course?.modules[0]?.lessons[0]?.files ?? {};
    expect(Object.keys(files).sort()).toEqual(['starter.ts', 'tests.ts']);
  });

  it('reports a YAML syntax error with file and line, and does not throw', () => {
    const broken = 'id: js.coercion\ntitle: "Values\nobjective: x\n';
    const { catalog, issues } = loadRawCatalog(rootWith({ [`${LESSON_DIR}/lesson.yaml`]: broken }));
    expect(catalog.course?.modules[0]?.lessons).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'error',
      rule: 'yaml-syntax',
      path: `${LESSON_DIR}/lesson.yaml`,
    });
    expect(issues[0]?.where).toMatch(/^line \d+$/);
  });

  it('explains an unquoted colon, the commonest YAML slip', () => {
    const lesson = fixtureTree()[`${LESSON_DIR}/lesson.yaml`] ?? '';
    const broken = lesson.replace(/^title: .*$/m, 'title: Values: types and coercion');
    const { issues } = loadRawCatalog(rootWith({ [`${LESSON_DIR}/lesson.yaml`]: broken }));
    expect(issues[0]?.rule).toBe('yaml-syntax');
    expect(issues[0]?.where).toBe('line 2');
    expect(issues[0]?.message).toContain('quotes');
  });

  it('reports a schema problem with the line it is on', () => {
    const lesson = fixtureTree()[`${LESSON_DIR}/lesson.yaml`] ?? '';
    const broken = lesson.replace(/^minutes: 12$/m, 'minutes: 240');
    const { issues } = loadRawCatalog(rootWith({ [`${LESSON_DIR}/lesson.yaml`]: broken }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'schema', severity: 'error' });
    const line = broken.split('\n').indexOf('minutes: 240') + 1;
    expect(issues[0]?.where).toBe(`line ${line}, minutes`);
  });

  it('reports a module folder with no module.yaml', () => {
    const { issues } = loadRawCatalog(
      rootWith({ 'content/course/03-javascript/module.yaml': undefined }),
    );
    expect(issues[0]).toMatchObject({
      rule: 'file-missing',
      path: 'content/course/03-javascript/module.yaml',
    });
  });

  it('reads the ids lock when there is one', () => {
    const lock = { schema: 1, published: ['lesson:js.coercion'], retired: [] };
    const { catalog } = loadRawCatalog(rootWith({ 'content/ids.lock.json': JSON.stringify(lock) }));
    expect(catalog.lock).toEqual(lock);
  });

  it('reports a lock that is not valid JSON', () => {
    const { catalog, issues } = loadRawCatalog(rootWith({ 'content/ids.lock.json': '{oops' }));
    expect(catalog.lock).toBeUndefined();
    expect(issues[0]).toMatchObject({ rule: 'lock-unreadable', path: 'content/ids.lock.json' });
  });

  it('reports a missing content folder instead of throwing', () => {
    const root = makeRoot({});
    roots.push(root);
    writeFileSync(path.join(root, 'README.md'), 'empty');
    const { catalog, issues } = loadRawCatalog(root);
    expect(catalog.course).toBeUndefined();
    expect(issues[0]).toMatchObject({ rule: 'file-missing', path: 'content/course' });
  });

  it('reports a missing course.yaml and still reads the modules for their own problems', () => {
    const { catalog, issues } = loadRawCatalog(
      rootWith({
        'content/course/course.yaml': undefined,
        [`${LESSON_DIR}/lesson.yaml`]: 'id: "unclosed',
      }),
    );
    expect(catalog.course).toBeUndefined();
    expect(issues.map((issue) => [issue.rule, issue.path])).toEqual([
      ['file-missing', 'content/course/course.yaml'],
      ['yaml-syntax', `${LESSON_DIR}/lesson.yaml`],
    ]);
  });
});
