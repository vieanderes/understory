import type { CapstoneSolution, Guide, LessonNotes } from './notes';
import type { Course, Lesson, Module } from './schema';

/*
 * The shapes that travel between the node-side readers (src/lib/content/fs.ts), the pure
 * validator (validate.ts) and the compiler (scripts/lib/compile.ts).
 *
 * "Raw" means parsed and schema-valid, but not yet checked across files and not yet
 * rendered. Paths are repo-relative with forward slashes so a message reads the same on
 * every machine.
 */

export type Severity = 'error' | 'warning';

/** One problem, written for the author of the file, not for the author of the validator. */
export interface Issue {
  severity: Severity;
  /** The file to open, for example `content/course/03-javascript/module.yaml`. */
  path: string;
  /** Where in the file: a step id, a card id, a line number. */
  where?: string;
  /** Plain English. Says what is wrong and what to do about it. */
  message: string;
  /** Stable rule name, so a test or a suppress list can point at it. */
  rule: string;
}

export interface RawLesson {
  /** Path of `lesson.yaml`. */
  path: string;
  /** Directory slug without the `NN-` prefix. It is the last URL segment. */
  slug: string;
  /** The `NN` prefix. It orders lessons inside the module. */
  order: number;
  data: Lesson;
  /**
   * Sibling source files named by code-challenge steps, keyed by file name.
   * A file that does not exist is absent here, and the validator reports it.
   */
  files: Readonly<Record<string, string>>;
  /** `notes.yaml` beside the lesson, when there is one (docs/LECTURE-BRIEF.md). */
  notes?: { path: string; data: LessonNotes };
}

export interface RawModule {
  /** Path of `module.yaml`. */
  path: string;
  slug: string;
  order: number;
  data: Module;
  lessons: RawLesson[];
}

/** The one course: `content/course/course.yaml` and the module folders beside it. */
export interface RawCourse {
  /** Path of `course.yaml`. */
  path: string;
  data: Course;
  modules: RawModule[];
  /** Worked capstone solutions from `content/capstones/`, keyed by part id. */
  capstones?: Readonly<Record<string, { path: string; data: CapstoneSolution }>>;
  /** Standalone readings from `content/guides/`, keyed by file name. */
  guides?: Readonly<Record<string, { path: string; data: Guide }>>;
}

/**
 * The registry of every id that has ever shipped. Progress events point at ids, so an id
 * that disappears orphans a learner's history and an id that comes back with new meaning
 * corrupts it.
 */
export interface IdsLock {
  schema: 1;
  published: string[];
  retired: string[];
}

export interface RawCatalog {
  /** Absent when `course.yaml` is missing or broken. The reader reports why. */
  course?: RawCourse;
  /** Absent when `content/ids.lock.json` has not been written yet. */
  lock?: IdsLock;
}

export const LOCK_PATH = 'content/ids.lock.json';
export const COURSE_DIR = 'content/course';
export const COURSE_PATH = `${COURSE_DIR}/course.yaml`;

/** Every lesson with the module that holds it. Saves two nested loops per rule. */
export interface LessonLocation {
  module: RawModule;
  lesson: RawLesson;
}

export function allLessons(catalog: RawCatalog): LessonLocation[] {
  return allModules(catalog).flatMap((module) =>
    module.lessons.map((lesson) => ({ module, lesson })),
  );
}

export function allModules(catalog: RawCatalog): RawModule[] {
  return catalog.course?.modules ?? [];
}
