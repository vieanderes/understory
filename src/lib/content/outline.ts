/**
 * Node-side access to `outline.yaml`, the plan of the course. Build time and scripts only.
 *
 *  - `getOutline` and `getPlannedLessons` are for server components: they throw a
 *    `ContentError` when the file is missing or wrong, because a page cannot show a plan
 *    it cannot read.
 *  - `loadOutline` and `readInterestLessonIds` are for the validator: they never throw
 *    and return issues instead, so every problem shows in one run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import * as z from '@/core/zod';
import type { Issue } from '@/core/content/catalog';
import type { ManifestLesson, ManifestModule } from '@/core/content/compiled';
import { journeyOrder, OUTLINE_PATH, outlineSchema, slugOfDir } from '@/core/content/outline';
import { hostModuleOf, partJourney } from '@/core/content/parts';
import type { Outline, OutlineLesson, RawOutline } from '@/core/content/outline';
import { INTERESTS_PATH } from '@/core/content/validate';
import { ContentError, contentRoot, readYaml } from './fs';
import { getManifest, getModules } from './loaders';

/** Relative to `content/`, the way `readYaml` wants it. */
const OUTLINE_FILE = OUTLINE_PATH.replace(/^content\//, '');

/** The plan of the course, read and checked against the schema. */
export async function getOutline(): Promise<Outline> {
  return readYaml(OUTLINE_FILE, outlineSchema);
}

export type PlannedStatus = 'published' | 'planned';

export interface PlannedLesson extends OutlineLesson {
  status: PlannedStatus;
  moduleId: string;
  /** URL segments, the same ones a published lesson is served under. */
  moduleSlug: string;
  slug: string;
  /** 1-based place in the journey, with woven lessons moved to where they are taught. */
  position: number;
  /** Present when published: minutes, step count and the bundle file of the lesson. */
  published?: ManifestLesson;
}

export interface PlannedModule {
  id: string;
  dir: string;
  slug: string;
  /** From the manifest. Absent until `pnpm build:content` has seen the module. */
  module?: ManifestModule;
  lessons: PlannedLesson[];
  publishedCount: number;
}

/**
 * The outline merged with the published manifest: every lesson of the course, in the order
 * of its module folder, marked `published` when the compiled bundle contains its id.
 */
export async function getPlannedLessons(): Promise<PlannedModule[]> {
  const outline = await getOutline();
  const modules = await getModules();
  const manifestModules = new Map(modules.map((module) => [module.id, module]));
  const published = new Map(
    modules.flatMap((module) => module.lessons.map((lesson) => [lesson.id, lesson])),
  );
  const position = new Map(journeyOrder(outline).map(({ lesson }, index) => [lesson.id, index + 1]));

  return outline.modules.map((planned) => {
    const manifestModule = manifestModules.get(planned.id);
    const lessons = planned.lessons.map((lesson): PlannedLesson => {
      const found = published.get(lesson.id);
      return {
        ...lesson,
        status: found ? 'published' : 'planned',
        moduleId: planned.id,
        moduleSlug: slugOfDir(planned.dir),
        slug: slugOfDir(lesson.dir),
        position: position.get(lesson.id) ?? 0,
        ...(found ? { published: found } : {}),
      };
    });
    return {
      id: planned.id,
      dir: planned.dir,
      slug: slugOfDir(planned.dir),
      ...(manifestModule ? { module: manifestModule } : {}),
      lessons,
      publishedCount: lessons.filter((lesson) => lesson.status === 'published').length,
    };
  });
}

/** One lesson row on the journey: published with a link and a time, or still planned. */
export interface JourneyLessonData {
  id: string;
  title: string;
  objective: string;
  level: 'essential' | 'advanced';
  href: string | null;
  minutes: number | null;
  /** For a woven lesson, the title of its own module (for example "CS fundamentals"). */
  wovenFrom?: string;
}

/** A chapter as the journey shows it: its own lessons and those woven into it. */
export interface JourneyChapterData {
  id: string;
  number: number;
  slug: string;
  title: string;
  summary: string;
  why: string;
  youCanBuild: string;
  lessons: JourneyLessonData[];
}

export interface JourneyPartData {
  id: string;
  /** 1-based, in course order. */
  number: number;
  title: string;
  summary: string;
  capstone: { title: string; brief: string };
  chapters: JourneyChapterData[];
}

/**
 * The course as the Learn page shows it: parts, then their chapters, then every planned
 * lesson in journey order. A woven lesson sits in the chapter of the lesson it follows.
 * A chapter appears once its module file is in the bundle.
 */
export async function getJourneyParts(): Promise<JourneyPartData[]> {
  const [outline, manifest] = await Promise.all([getOutline(), getManifest()]);
  const modules = new Map(manifest.modules.map((module) => [module.id, module]));
  const published = new Map(
    manifest.modules.flatMap((module) => module.lessons.map((lesson) => [lesson.id, lesson])),
  );
  const host = hostModuleOf(outline);
  const byPart = new Map(
    partJourney(outline, manifest.parts.map((part) => ({ ...part }))).map((journey) => [
      journey.part.id,
      journey.lessons,
    ]),
  );

  return manifest.parts.map((part, index) => {
    const lessons = byPart.get(part.id) ?? [];
    const chapters = part.modules.flatMap((moduleId): JourneyChapterData[] => {
      const chapter = modules.get(moduleId);
      if (!chapter) return [];
      const rows = lessons
        .filter(({ lesson }) => host.get(lesson.id) === moduleId)
        .map(({ module: own, lesson }): JourneyLessonData => {
          const found = published.get(lesson.id);
          return {
            id: lesson.id,
            title: lesson.title,
            objective: lesson.objective,
            level: lesson.level,
            href: found ? `/learn/${slugOfDir(own.dir)}/${slugOfDir(lesson.dir)}` : null,
            minutes: found?.minutes ?? null,
            ...(own.id === moduleId ? {} : { wovenFrom: modules.get(own.id)?.title ?? own.id }),
          };
        });
      const { id, number, slug, title, summary, why, youCanBuild } = chapter;
      return [{ id, number, slug, title, summary, why, youCanBuild, lessons: rows }];
    });
    const { id, title, summary, capstone } = part;
    return { id, number: index + 1, title, summary, capstone, chapters };
  });
}

// ---------------------------------------------------------------------------
// For the validator
// ---------------------------------------------------------------------------

export interface LoadedOutline {
  /** Absent when there is no outline, or when it cannot be read. */
  outline?: RawOutline;
  issues: Issue[];
  /** How many outline files were looked at, for the summary line. */
  checked: number;
}

/** Reads the outline of the course. A content tree without one (a test fixture) is skipped. */
export function loadOutline(root = contentRoot()): LoadedOutline {
  if (!fs.existsSync(path.join(root, OUTLINE_PATH))) return { issues: [], checked: 0 };
  try {
    const data = readYaml(OUTLINE_FILE, outlineSchema, root);
    return { outline: { path: OUTLINE_PATH, data }, issues: [], checked: 1 };
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    // The first line of the message repeats the path, which the issue already carries.
    const message = error.message.split('\n').slice(1).map((line) => line.trim()).join(' ');
    return {
      issues: [{ severity: 'error', rule: 'outline-unreadable', path: OUTLINE_PATH, message }],
      checked: 1,
    };
  }
}

/** Only the ids are needed here. scripts/news checks the rest of the file. */
const lessonIndexSchema = z.object({
  lessons: z.array(z.object({ id: z.string() })).default([]),
});

/** Lesson ids named by the lesson index of `content/interests.yaml`. Empty when unreadable. */
export function readInterestLessonIds(root = contentRoot()): string[] {
  const abs = path.join(root, INTERESTS_PATH);
  if (!fs.existsSync(abs)) return [];
  try {
    const parsed = lessonIndexSchema.safeParse(parse(fs.readFileSync(abs, 'utf8')));
    return parsed.success ? parsed.data.lessons.map((lesson) => lesson.id) : [];
  } catch {
    // A YAML error in the reader profile is reported by the news validator.
    return [];
  }
}
