import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { journeyOrder, outlineEntries } from '@/core/content/outline';
import { ContentError, resetContentCache } from '@/lib/content';
import {
  getOutline,
  getJourneyParts,
  getPlannedLessons,
  loadOutline,
  readInterestLessonIds,
} from '@/lib/content/outline';
import { checkContent } from '../../../../scripts/lib/check';
import { compileCatalog, writeBundle } from '../../../../scripts/lib/compile';
import type { Renderer } from '../../../../scripts/lib/render';
import { moduleOf, validCatalog } from '../../core/content/fixtures';
import { fixtureTree, makeRoot, removeRoot, REPO } from './helpers';

const OUTLINE_FILE = 'content/course/outline.yaml';

const lesson = (id: string, dir: string, extra: Record<string, unknown> = {}) => ({
  id,
  dir,
  title: 'Values, types and coercion',
  objective: 'Predict the result of `+` on mixed types.',
  level: 'essential',
  concepts: ['js.coercion', 'js.coercion'],
  ...extra,
});

const OUTLINE_INPUT = {
  modules: [
    {
      id: 'js',
      dir: '03-javascript',
      lessons: [lesson('js.coercion', '01-coercion'), lesson('js.closures', '02-scope-and-closures')],
    },
  ],
};

const roots: string[] = [];
const rootWith = (changes: Record<string, string> = {}): string => {
  const root = makeRoot({ ...fixtureTree(), [OUTLINE_FILE]: stringify(OUTLINE_INPUT), ...changes });
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

describe('loadOutline', () => {
  it('reads the outline of the course', () => {
    const { outline, issues, checked } = loadOutline(rootWith());
    expect(issues).toEqual([]);
    expect(checked).toBe(1);
    expect(outline?.path).toBe(OUTLINE_FILE);
    expect(outline?.data.modules[0]?.lessons).toHaveLength(2);
  });

  it('skips a course with no outline, and a repo with no course', () => {
    const root = makeRoot(fixtureTree());
    roots.push(root);
    expect(loadOutline(root)).toEqual({ issues: [], checked: 0 });
    const empty = makeRoot({});
    roots.push(empty);
    expect(loadOutline(empty)).toEqual({ issues: [], checked: 0 });
  });

  it('reports an outline that breaks the schema, with the place and the hint', () => {
    const broken = { modules: [{ id: 'js', dir: 'javascript', lessons: OUTLINE_INPUT.modules[0]?.lessons }] };
    const { outline, issues } = loadOutline(rootWith({ [OUTLINE_FILE]: stringify(broken) }));
    expect(outline).toBeUndefined();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', rule: 'outline-unreadable', path: OUTLINE_FILE });
    expect(issues[0]?.message).toContain('03-javascript');
  });

  it('reports YAML that cannot be parsed', () => {
    const { issues } = loadOutline(rootWith({ [OUTLINE_FILE]: 'modules: "unclosed' }));
    expect(issues.map((issue) => issue.rule)).toEqual(['outline-unreadable']);
  });
});

describe('readInterestLessonIds', () => {
  it('reads the ids of the lesson index and ignores the rest of the file', () => {
    const interests = { minScore: 1, lessons: [{ id: 'js.coercion', title: 'T', keywords: ['k'] }, { id: 'db.indexes' }] };
    const root = rootWith({ 'content/interests.yaml': stringify(interests) });
    expect(readInterestLessonIds(root)).toEqual(['js.coercion', 'db.indexes']);
  });

  it('gives an empty list for a missing, unparsable or differently shaped file', () => {
    expect(readInterestLessonIds(rootWith())).toEqual([]);
    expect(readInterestLessonIds(rootWith({ 'content/interests.yaml': 'lessons: [' }))).toEqual([]);
    expect(readInterestLessonIds(rootWith({ 'content/interests.yaml': 'lessons: 3' }))).toEqual([]);
    expect(readInterestLessonIds(rootWith({ 'content/interests.yaml': 'minScore: 1' }))).toEqual([]);
  });
});

describe('checkContent with an outline', () => {
  it('counts the outline file and stays quiet when plan and content agree', async () => {
    const { issues, checked } = await checkContent(rootWith());
    expect(issues.map((issue) => issue.rule)).toEqual(['lock-stale']);
    expect(checked).toBe(4);
  });

  it('reports a published lesson that the outline does not plan', async () => {
    const plan = { modules: [{ ...OUTLINE_INPUT.modules[0], lessons: [lesson('js.closures', '01-scope-and-closures')] }] };
    const { issues } = await checkContent(rootWith({ [OUTLINE_FILE]: stringify(plan) }));
    expect(issues.map((issue) => issue.rule)).toContain('outline-lesson-unplanned');
  });

  it('reports a lesson index id that the outline does not plan', async () => {
    const interests = { lessons: [{ id: 'js.coercion' }, { id: 'devops.backups' }] };
    const { issues } = await checkContent(rootWith({ 'content/interests.yaml': stringify(interests) }));
    const found = issues.filter((issue) => issue.rule === 'interests-lesson-unknown');
    expect(found.map((issue) => issue.where)).toEqual(['devops.backups']);
  });

  it('reports an unreadable outline once, and then checks nothing against it', async () => {
    const { issues } = await checkContent(rootWith({ [OUTLINE_FILE]: 'modules: []' }));
    expect(issues.map((issue) => issue.rule).sort()).toEqual(['lock-stale', 'outline-unreadable']);
  });

  it('keeps quiet about the outline while a module file is unreadable', async () => {
    const root = rootWith({ 'content/course/03-javascript/module.yaml': 'id: "unclosed' });
    const { issues } = await checkContent(root);
    // Without the module, every planned concept would look undefined.
    expect(issues.map((issue) => issue.rule)).toEqual(['yaml-syntax']);
  });
});

describe('getOutline and getPlannedLessons', () => {
  const renderer: Renderer = {
    markdown: (md) => `<p>${md}</p>`,
    inline: (md) => md,
    code: (code) => `<pre>${code}</pre>`,
  };
  const plan = {
    modules: [
      ...OUTLINE_INPUT.modules,
      { id: 'cs', dir: '17-cs-fundamentals', lessons: [lesson('cs.complexity', '01-complexity', { wovenAfter: 'js.coercion' })] },
    ],
  };
  const root = makeRoot({ [OUTLINE_FILE]: stringify(plan) });
  const previousRoot = process.env.CONTENT_ROOT;

  beforeAll(() => {
    process.env.CONTENT_ROOT = root;
    writeBundle(path.join(root, 'public/content/v1'), compileCatalog(validCatalog(), renderer));
    resetContentCache();
  });
  afterAll(() => {
    if (previousRoot === undefined) delete process.env.CONTENT_ROOT;
    else process.env.CONTENT_ROOT = previousRoot;
    resetContentCache();
    removeRoot(root);
  });

  it('getOutline reads and validates the plan of the course', async () => {
    const outline = await getOutline();
    expect(outline.modules.map((module) => module.id)).toEqual(['js', 'cs']);
  });

  it('getOutline throws a ContentError when the course has no outline', async () => {
    const other = makeRoot({});
    roots.push(other);
    process.env.CONTENT_ROOT = other;
    try {
      await expect(getOutline()).rejects.toBeInstanceOf(ContentError);
    } finally {
      process.env.CONTENT_ROOT = root;
    }
  });

  it('marks each lesson as published or planned', async () => {
    const [js, cs] = await getPlannedLessons();
    expect(js?.lessons.map((entry) => [entry.id, entry.status])).toEqual([
      ['js.coercion', 'published'],
      ['js.closures', 'planned'],
    ]);
    expect(js?.publishedCount).toBe(1);
    expect(cs?.publishedCount).toBe(0);
  });

  it('carries the manifest entries of what is published, and the URL segments of everything', async () => {
    const [js, cs] = await getPlannedLessons();
    expect(js?.module?.title).toBe('JavaScript');
    expect(cs?.module).toBeUndefined();
    const [coercion, closures] = js?.lessons ?? [];
    expect(coercion?.published?.minutes).toBe(12);
    expect(closures?.published).toBeUndefined();
    expect(closures).toMatchObject({ moduleId: 'js', moduleSlug: 'javascript', slug: 'scope-and-closures' });
    expect(cs).toMatchObject({ id: 'cs', dir: '17-cs-fundamentals', slug: 'cs-fundamentals' });
  });

  it('numbers lessons in journey order, with woven lessons where they are taught', async () => {
    const modules = await getPlannedLessons();
    const positions = modules.flatMap((module) => module.lessons.map((entry) => [entry.id, entry.position]));
    expect(positions).toEqual([
      ['js.coercion', 1],
      ['js.closures', 3],
      ['cs.complexity', 2],
    ]);
  });

  it('groups the journey into parts and chapters, with woven lessons where they are taught', async () => {
    const other = makeRoot({ [OUTLINE_FILE]: stringify(plan) });
    roots.push(other);
    process.env.CONTENT_ROOT = other;
    const catalog = validCatalog();
    if (!catalog.course) throw new Error('fixture');
    const capstone = { title: 'A cart', brief: 'Build a cart.' };
    catalog.course.data = {
      ...catalog.course.data,
      parts: [{ id: 'first', title: 'First', summary: 'You can code.', modules: ['js'], capstone }],
    };
    writeBundle(path.join(other, 'public/content/v1'), compileCatalog(catalog, renderer));
    resetContentCache();
    try {
      const [first, ...rest] = await getJourneyParts();
      expect(rest).toEqual([]);
      expect(first).toMatchObject({ id: 'first', number: 1, title: 'First', capstone });
      const [chapter] = first?.chapters ?? [];
      expect(chapter).toMatchObject({ id: 'js', title: 'JavaScript', slug: 'javascript' });
      expect(chapter?.lessons.map((l) => [l.id, l.href, l.minutes, l.wovenFrom ?? null])).toEqual([
        ['js.coercion', '/learn/javascript/coercion', 12, null],
        ['cs.complexity', null, null, 'cs'],
        ['js.closures', null, null, null],
      ]);
    } finally {
      process.env.CONTENT_ROOT = root;
      resetContentCache();
    }
  });

  it('plans every lesson as planned when the manifest publishes none of them', async () => {
    const other = makeRoot({ [OUTLINE_FILE]: stringify(OUTLINE_INPUT) });
    roots.push(other);
    process.env.CONTENT_ROOT = other;
    const unpublished = validCatalog();
    moduleOf(unpublished).lessons = [];
    writeBundle(path.join(other, 'public/content/v1'), compileCatalog(unpublished, renderer));
    resetContentCache();
    try {
      const [js] = await getPlannedLessons();
      expect(js?.module?.title).toBe('JavaScript');
      expect(js?.lessons.every((entry) => entry.status === 'planned')).toBe(true);
    } finally {
      process.env.CONTENT_ROOT = root;
      resetContentCache();
    }
  });
});

describe('the real outline', () => {
  const { outline: raw, issues } = loadOutline(REPO);
  const outline = raw?.data ?? { modules: [] };

  it('is readable and holds the 34 modules and 419 lessons of docs/CURRICULUM.md', () => {
    expect(issues).toEqual([]);
    expect(outline.modules).toHaveLength(34);
    // Folders are numbered in the order modules were added, and the file lists them in course
    // order: Integrations follows Scale, and Agent engineering follows AI systems.
    const numbers = outline.modules.map((module) => Number(module.dir.slice(0, 2)));
    expect([...numbers].sort((a, b) => a - b)).toEqual([...Array(34).keys()]);
    expect(numbers.indexOf(30)).toBe(numbers.indexOf(14) + 1);
    expect(numbers.indexOf(31)).toBe(numbers.indexOf(21) + 1);
    expect(outlineEntries(outline)).toHaveLength(419);
  });

  it('names every lesson id next to its title in docs/CURRICULUM.md, in order', () => {
    const map = readFileSync(path.join(REPO, 'docs/CURRICULUM.md'), 'utf8');
    const listed = [...map.matchAll(/^\d+\. [^\n]*?`([a-z][a-z0-9]*\.[a-z0-9-]+)`:/gm)].map((match) => match[1]);
    expect(listed).toEqual(outlineEntries(outline).map(({ lesson }) => lesson.id));
  });

  it('weaves every cs, clean, pro, nextserver, judgment and explain lesson, and only those, into the journey', () => {
    const woven = outlineEntries(outline).filter(({ lesson }) => lesson.wovenAfter !== undefined);
    expect(woven.map(({ module }) => module.id)).toEqual([
      // ts.configuration needs the terminal and the checks from Tooling, so it follows them.
      'ts',
      ...Array(10).fill('cs'),
      ...Array(10).fill('clean'),
      ...Array(9).fill('pro'),
      ...Array(4).fill('nextserver'),
      ...Array(12).fill('judgment'),
      ...Array(8).fill('explain'),
    ]);
    const order = journeyOrder(outline).map(({ lesson }) => lesson.id);
    expect(order).toHaveLength(419);
    expect(order.indexOf('cs.complexity')).toBe(order.indexOf('js.arrays') + 1);
    expect(order.indexOf('cs.trees')).toBeLessThan(order.indexOf('db.indexes'));
    expect(order.indexOf('clean.naming')).toBe(order.indexOf('js.built-in-toolbox') + 1);
    expect(order.indexOf('pro.pythonic')).toBe(order.indexOf('python.report-tool') + 1);
    expect(order.indexOf('pro.amateur-tells')).toBe(order.indexOf('tooling.quality-gates') + 1);
    expect(order.indexOf('ts.configuration')).toBe(order.indexOf('pro.modern-javascript') + 1);
    expect(order.indexOf('clean.code-review')).toBe(order.indexOf('cloud.progressive-delivery') + 1);
    expect(order.indexOf('nextserver.route-handlers')).toBe(order.indexOf('backend.validation') + 1);
    expect(order.indexOf('nextserver.deploying')).toBe(order.indexOf('cloud.reverse-proxies') + 1);
    expect(order.indexOf('judgment.what-to-verify')).toBe(order.indexOf('tooling.working-with-ai') + 1);
    expect(order.indexOf('explain.say-it-plainly')).toBe(order.indexOf('basics.small-program') + 1);
    // A woven lesson can follow another woven lesson: the diagram talk follows the drawing.
    expect(order.indexOf('judgment.workflows-on-paper')).toBe(order.indexOf('judgment.intents-and-priorities') + 1);
    expect(order.indexOf('explain.talking-through-a-diagram')).toBe(order.indexOf('judgment.workflows-on-paper') + 1);
    expect(order.indexOf('judgment.ready-to-launch')).toBe(order.indexOf('agents.babysitting-a-pr') + 1);
    expect(order.indexOf('integrations.systems-you-dont-control')).toBe(order.indexOf('scale.failure-handling') + 1);
  });

  // A full content check, solution gate included, which takes a while on a busy machine.
  it('passes every outline rule against the real content', { timeout: 180_000 }, async () => {
    const result = await checkContent(REPO);
    const ours = result.issues.filter(
      (issue) => /^(outline|interests|confusable)-/.test(issue.rule),
    );
    expect(ours).toEqual([]);
  });
});
