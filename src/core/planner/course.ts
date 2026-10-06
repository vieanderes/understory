import type {
  Manifest,
  ManifestLesson,
  ManifestModule,
  ManifestPart,
} from '@/core/content/compiled';

/*
 * What planning needs from the course: the manifest's shape, narrowed, so a test can build a
 * course by hand and the planner never depends on fields it does not read.
 */

export type PlannerLesson = Pick<
  ManifestLesson,
  'id' | 'title' | 'objective' | 'level' | 'minutes' | 'prerequisites'
>;

export type PlannerModule = Pick<
  ManifestModule,
  'id' | 'number' | 'title' | 'summary' | 'youCanBuild'
> & {
  lessons: readonly PlannerLesson[];
};

export type PlannerPart = Pick<ManifestPart, 'id' | 'title' | 'summary' | 'modules'>;

export interface PlannerCourse {
  modules: readonly PlannerModule[];
  parts: readonly PlannerPart[];
}

/** A written path, as Scout reads it: its stages as lesson ids it can reuse. */
export interface PlannerPath {
  id: string;
  name: string;
  promise?: string;
  stages: readonly { title: string; lessonIds: readonly string[] }[];
}

export interface LessonEntry {
  lesson: PlannerLesson;
  moduleId: string;
  /** Position in the course, for "in course order". */
  order: number;
}

export function lessonIndex(course: PlannerCourse): ReadonlyMap<string, LessonEntry> {
  const index = new Map<string, LessonEntry>();
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      index.set(lesson.id, { lesson, moduleId: mod.id, order: index.size });
    }
  }
  return index;
}

/** The manifest satisfies the planner's course as it is. */
export const plannerCourse = (manifest: Pick<Manifest, 'modules' | 'parts'>): PlannerCourse =>
  manifest;
