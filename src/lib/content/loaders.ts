/**
 * Typed getters for server components. They read the compiled bundle from disk (the files
 * that `pnpm build:content` writes to public/content/v1), never over HTTP, so a static
 * build needs no running server and the page shows the very bytes the client will fetch.
 *
 * Everything is async so a page can put `'use cache'` on top of a call without a change
 * here. Results are cached per process, and the cache is dropped when the manifest file
 * changes, which is what a content rebuild during `next dev` does.
 */
import fs from 'node:fs';
import path from 'node:path';
import type * as z from '@/core/zod';
import {
  compiledCapstoneSolutionSchema,
  compiledGuideSchema,
  compiledLectureExtrasSchema,
  compiledLessonSchema,
  compiledPlacementSchema,
  manifestSchema,
} from '@/core/content/compiled-schema';
import type {
  CompiledCapstoneSolution,
  CompiledGuide,
  CompiledLectureExtras,
  CompiledLesson,
  Manifest,
  ManifestCourse,
  ManifestLesson,
  ManifestModule,
} from '@/core/content/compiled';
import type { CompiledPlacementFile } from '@/core/content/placement-schema';
import type { Concept } from '@/core/content/schema';
import { ContentError, contentRoot } from './fs';

export interface LessonRoute {
  moduleSlug: string;
  lessonSlug: string;
  lessonId: string;
}

export interface ConceptEntry {
  concept: Concept;
  moduleId: string;
  /** Lessons that list the concept, in course order. */
  lessonIds: string[];
}

export interface CatalogSummary {
  contentRev: string;
  modules: number;
  lessons: number;
  essentialLessons: number;
  concepts: number;
  steps: number;
  minutes: number;
}

const BUNDLE_PATH = 'public/content/v1';
const REBUILD = 'Run "pnpm build:content" to rebuild the bundle.';

interface Cache {
  dir: string;
  /** Modified time and size of manifest.json. A rebuild changes at least one of them. */
  stamp: string;
  manifest: Manifest;
  lessons: Map<string, CompiledLesson>;
}

let cache: Cache | undefined;

/** For tests, and for a dev tool that wants a fresh read. */
export function resetContentCache(): void {
  cache = undefined;
}

function readJson<T>(dir: string, file: string, schema: z.ZodType<T>): T {
  const rel = `${BUNDLE_PATH}/${file}`;
  const abs = path.join(dir, file);
  if (!fs.existsSync(abs)) throw new ContentError(rel, `This file is missing. ${REBUILD}`);
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(abs, 'utf8')));
  if (!parsed.success) {
    throw new ContentError(rel, `This file does not match the bundle schema. ${REBUILD}`);
  }
  return parsed.data;
}

function current(): Cache {
  const dir = path.join(contentRoot(), BUNDLE_PATH);
  const manifestPath = path.join(dir, 'manifest.json');
  const stat = fs.existsSync(manifestPath) ? fs.statSync(manifestPath) : undefined;
  const stamp = stat ? `${stat.mtimeMs}:${stat.size}` : 'missing';
  if (cache?.dir !== dir || cache.stamp !== stamp) {
    const manifest = readJson(dir, 'manifest.json', manifestSchema);
    cache = { dir, stamp, manifest, lessons: new Map() };
  }
  return cache;
}

interface Located {
  module: ManifestModule;
  lesson: ManifestLesson;
}

const locate = (manifest: Manifest): Located[] =>
  manifest.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));

function load(entry: ManifestLesson | undefined): CompiledLesson | undefined {
  if (!entry) return undefined;
  const { dir, lessons } = current();
  const cached = lessons.get(entry.file);
  if (cached) return cached;
  const lesson = readJson(dir, entry.file, compiledLessonSchema);
  lessons.set(entry.file, lesson);
  return lesson;
}

/** The placement ladder (`placement.json`). It is small and read once per build. */
export async function getPlacement(): Promise<CompiledPlacementFile> {
  const { dir } = current();
  return readJson(dir, 'placement.json', compiledPlacementSchema) as CompiledPlacementFile;
}

export async function getManifest(): Promise<Manifest> {
  return current().manifest;
}

/** The title and summary of the one course. */
export async function getCourse(): Promise<ManifestCourse> {
  return current().manifest.course;
}

/** Every module of the course, in course order. */
export async function getModules(): Promise<ManifestModule[]> {
  return current().manifest.modules;
}

/** `moduleId` may be the module id (`js`) or its URL slug (`javascript`). */
export async function getModule(moduleId: string): Promise<ManifestModule | undefined> {
  return current().manifest.modules.find(
    (module) => module.id === moduleId || module.slug === moduleId,
  );
}

export async function getLesson(lessonId: string): Promise<CompiledLesson | undefined> {
  return load(locate(current().manifest).find(({ lesson }) => lesson.id === lessonId)?.lesson);
}

/** Notes and highlighted solutions for a lecture. Never fetched by the lesson player. */
export async function getLectureExtras(lessonId: string): Promise<CompiledLectureExtras | undefined> {
  const { dir, manifest } = current();
  const entry = locate(manifest).find(({ lesson }) => lesson.id === lessonId)?.lesson;
  return entry ? readJson(dir, entry.lectureFile, compiledLectureExtrasSchema) : undefined;
}

/** The worked solution of a part's capstone, when one has been written. */
export async function getCapstoneSolution(
  partId: string,
): Promise<CompiledCapstoneSolution | undefined> {
  const { dir, manifest } = current();
  const file = manifest.parts.find((part) => part.id === partId)?.capstone.solutionFile;
  return file ? readJson(dir, file, compiledCapstoneSolutionSchema) : undefined;
}

/** A standalone reading from `content/guides/`, compiled. */
export async function getGuide(id: string): Promise<CompiledGuide | undefined> {
  const { dir, manifest } = current();
  const file = manifest.guides.find((guide) => guide.id === id)?.file;
  return file ? readJson(dir, file, compiledGuideSchema) : undefined;
}

export async function getLessonByRoute(
  moduleSlug: string,
  lessonSlug: string,
): Promise<CompiledLesson | undefined> {
  const found = locate(current().manifest).find(
    ({ module, lesson }) => module.slug === moduleSlug && lesson.slug === lessonSlug,
  );
  return load(found?.lesson);
}

export async function getAllLessonRoutes(): Promise<LessonRoute[]> {
  return locate(current().manifest).map(({ module, lesson }) => ({
    moduleSlug: module.slug,
    lessonSlug: lesson.slug,
    lessonId: lesson.id,
  }));
}

export async function getConcept(id: string): Promise<ConceptEntry | undefined> {
  for (const owner of current().manifest.modules) {
    const concept = owner.concepts.find((candidate) => candidate.id === id);
    if (!concept) continue;
    const lessonIds = locate(current().manifest)
      .filter(({ lesson }) => lesson.concepts.includes(id))
      .map(({ lesson }) => lesson.id);
    return { concept, moduleId: owner.id, lessonIds };
  }
  return undefined;
}

export async function getCatalogSummary(): Promise<CatalogSummary> {
  const { manifest } = current();
  const { modules } = manifest;
  const lessons = modules.flatMap((module) => module.lessons);
  const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
  return {
    contentRev: manifest.contentRev,
    modules: modules.length,
    lessons: lessons.length,
    essentialLessons: lessons.filter((lesson) => lesson.level === 'essential').length,
    concepts: sum(modules.map((module) => module.concepts.length)),
    steps: sum(lessons.map((lesson) => lesson.stepCount)),
    minutes: sum(lessons.map((lesson) => lesson.minutes)),
  };
}
