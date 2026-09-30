import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ContentError,
  getAllLessonRoutes,
  getCatalogSummary,
  getConcept,
  getCourse,
  getLesson,
  getLessonByRoute,
  getModule,
  getModules,
  resetContentCache,
} from '@/lib/content';
import { compileCatalog, writeBundle } from '../../../../scripts/lib/compile';
import type { Renderer } from '../../../../scripts/lib/render';
import { validCatalog } from '../../core/content/fixtures';
import { makeRoot, removeRoot } from './helpers';

const renderer: Renderer = {
  markdown: (md) => `<p>${md}</p>`,
  inline: (md) => md,
  code: (code) => `<pre>${code}</pre>`,
};

describe('content loaders', () => {
  const root = makeRoot({});
  const bundleDir = path.join(root, 'public/content/v1');
  const previousRoot = process.env.CONTENT_ROOT;

  beforeAll(() => {
    process.env.CONTENT_ROOT = root;
  });
  beforeEach(() => {
    writeBundle(bundleDir, compileCatalog(validCatalog(), renderer));
    resetContentCache();
  });
  afterAll(() => {
    if (previousRoot === undefined) delete process.env.CONTENT_ROOT;
    else process.env.CONTENT_ROOT = previousRoot;
    removeRoot(root);
  });

  it('getCourse gives the title and summary of the one course', async () => {
    expect(await getCourse()).toEqual({ title: 'The course', summary: 'From a page to a system.' });
  });

  it('getModules lists the modules of the course in order', async () => {
    expect((await getModules()).map((module) => module.id)).toEqual(['js']);
  });

  it('getModule finds a module by id or by slug', async () => {
    expect((await getModule('js'))?.slug).toBe('javascript');
    expect((await getModule('javascript'))?.id).toBe('js');
    expect(await getModule('css')).toBeUndefined();
  });

  it('getLesson returns the compiled lesson', async () => {
    const lesson = await getLesson('js.coercion');
    expect(lesson?.title).toBe('Values, types and coercion');
    const prose = lesson?.steps[0];
    expect(prose?.type === 'prose' && prose.body.html).toBe(
      '<p>The quantity field holds text, not a number.</p>',
    );
    expect(await getLesson('js.nope')).toBeUndefined();
  });

  it('getLessonByRoute resolves the two URL segments', async () => {
    expect((await getLessonByRoute('javascript', 'coercion'))?.id).toBe('js.coercion');
    expect(await getLessonByRoute('javascript', 'nope')).toBeUndefined();
    expect(await getLessonByRoute('nope', 'coercion')).toBeUndefined();
  });

  it('getAllLessonRoutes feeds generateStaticParams', async () => {
    expect(await getAllLessonRoutes()).toEqual([
      { moduleSlug: 'javascript', lessonSlug: 'coercion', lessonId: 'js.coercion' },
    ]);
  });

  it('getConcept says where a concept is defined and which lessons teach it', async () => {
    expect(await getConcept('js.coercion')).toEqual({
      concept: { id: 'js.coercion', title: 'Type coercion', summary: 'Implicit conversion.' },
      moduleId: 'js',
      lessonIds: ['js.coercion'],
    });
    expect((await getConcept('js.equality'))?.lessonIds).toEqual([]);
    expect(await getConcept('js.nope')).toBeUndefined();
  });

  it('getCatalogSummary counts what there is', async () => {
    expect(await getCatalogSummary()).toEqual({
      contentRev: expect.stringMatching(/^[0-9a-f]{12}$/) as string,
      modules: 1,
      lessons: 1,
      essentialLessons: 1,
      concepts: 2,
      steps: 11,
      minutes: 12,
    });
  });

  it('caches a lesson: a second read does not touch the disk', async () => {
    const first = await getLesson('js.coercion');
    rmSync(path.join(bundleDir, 'lessons'), { recursive: true });
    expect(await getLesson('js.coercion')).toBe(first);
  });

  it('notices a rebuilt bundle, so the dev server shows edited content', async () => {
    const before = await getCatalogSummary();
    const manifestPath = path.join(bundleDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({
        schema: 1,
        contentRev: '0123456789ab',
        course: { title: 'Rebuilt', summary: 'A new bundle.' },
        modules: [],
        parts: [],
        guides: [],
      }),);
    expect((await getCatalogSummary()).contentRev).not.toBe(before.contentRev);
  });

  it('says how to fix a missing bundle', async () => {
    rmSync(bundleDir, { recursive: true });
    resetContentCache();
    await expect(getModules()).rejects.toThrowError(ContentError);
    await expect(getModules()).rejects.toThrowError(/pnpm build:content/);
  });

  it('says how to fix a bundle from another schema version', async () => {
    writeFileSync(path.join(bundleDir, 'manifest.json'), JSON.stringify({ schema: 2 }));
    resetContentCache();
    await expect(getModules()).rejects.toThrowError(/pnpm build:content/);
  });
});
