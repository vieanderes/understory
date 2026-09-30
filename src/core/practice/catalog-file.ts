import type { Catalog } from './catalog';

/**
 * `catalog.json` in the content bundle: the whole course as an index, without any lesson
 * text. Practice, the map and Today need to know every concept, every scored step and
 * every recall card to pick what comes next, but they only load the lessons they show.
 */
export interface CatalogFile extends Catalog {
  readonly schema: 1;
  readonly contentRev: string;
  readonly modules: readonly CatalogModule[];
  readonly concepts: readonly CatalogFileConcept[];
  /** Lesson id to where its compiled file and its page live. */
  readonly lessons: Readonly<Record<string, CatalogLesson>>;
  /** The parts of the course in order, as in the manifest. Empty for a course without. */
  readonly parts: readonly CatalogPart[];
}

/** A part: its published lessons and concepts in journey order, and its capstone. */
export interface CatalogPart {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly modules: readonly string[];
  readonly capstone: { readonly title: string; readonly brief: string };
  readonly lessons: readonly string[];
  readonly concepts: readonly string[];
}

export interface CatalogModule {
  readonly id: string;
  readonly number: number;
  readonly slug: string;
  readonly title: string;
}

export interface CatalogFileConcept {
  readonly id: string;
  readonly moduleId: string;
  readonly title: string;
  readonly summary: string;
  readonly confusableWith?: readonly string[];
}

export interface CatalogLesson {
  readonly title: string;
  readonly moduleId: string;
  readonly moduleSlug: string;
  readonly slug: string;
  readonly level: 'essential' | 'advanced';
  readonly minutes: number;
  readonly concepts: readonly string[];
  /** Path of the compiled lesson inside the bundle, for example `lessons/js.closures.ab12.json`. */
  readonly file: string;
  readonly solutionsFile?: string;
}
