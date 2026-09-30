import { journeyOrder, outlineEntries } from './outline';
import type { Outline, OutlineEntry } from './outline';
import type { Part } from './schema';

/*
 * Which part of the course each lesson counts towards. A part names modules, so a lesson
 * of one of those modules belongs to it. A woven module (cs, clean, pro) belongs to no
 * part: each of its lessons counts towards the part of the lesson it is woven after, and
 * that lesson may itself be woven, so the link is followed to the end of the chain.
 */

/** Modules whose every planned lesson is woven after a lesson elsewhere. */
export function wovenModuleIds(outline: Outline): Set<string> {
  return new Set(
    outline.modules
      .filter((module) => module.lessons.every((lesson) => lesson.wovenAfter !== undefined))
      .map((module) => module.id),
  );
}

/** Lesson id to part id. A lesson whose chain reaches no part is left out. */
export function partOfLessons(outline: Outline, parts: readonly Part[]): Map<string, string> {
  const partOfModule = new Map(parts.flatMap((part) => part.modules.map((m) => [m, part.id])));
  const entries = new Map(outlineEntries(outline).map((entry) => [entry.lesson.id, entry]));

  const resolve = (lessonId: string, seen: Set<string>): string | undefined => {
    const entry = entries.get(lessonId);
    if (!entry || seen.has(lessonId)) return undefined;
    seen.add(lessonId);
    const direct = partOfModule.get(entry.module.id);
    if (direct !== undefined) return direct;
    return entry.lesson.wovenAfter === undefined
      ? undefined
      : resolve(entry.lesson.wovenAfter, seen);
  };

  const result = new Map<string, string>();
  for (const id of entries.keys()) {
    const partId = resolve(id, new Set());
    if (partId !== undefined) result.set(id, partId);
  }
  return result;
}

export interface PartJourney {
  part: Part;
  /** Every planned lesson of the part, woven ones included, in journey order. */
  lessons: OutlineEntry[];
  /** The concepts those lessons teach, each once, where it is first taught. */
  concepts: string[];
}

/** Each part with its lessons and concepts in journey order. */
export function partJourney(outline: Outline, parts: readonly Part[]): PartJourney[] {
  const of = partOfLessons(outline, parts);
  const journey = journeyOrder(outline);
  return parts.map((part) => {
    const lessons = journey.filter(({ lesson }) => of.get(lesson.id) === part.id);
    const concepts = [...new Set(lessons.flatMap(({ lesson }) => lesson.concepts))];
    return { part, lessons, concepts };
  });
}

/**
 * Lesson id to the module whose chapter shows it. A woven lesson is shown in the chapter
 * of the lesson it follows, through chains; one whose chain reaches no taught module
 * stays in its own.
 */
export function hostModuleOf(outline: Outline): Map<string, string> {
  const woven = wovenModuleIds(outline);
  const entries = new Map(outlineEntries(outline).map((entry) => [entry.lesson.id, entry]));
  const resolve = (lessonId: string, seen: Set<string>): string | undefined => {
    const entry = entries.get(lessonId);
    if (!entry || seen.has(lessonId)) return undefined;
    seen.add(lessonId);
    if (!woven.has(entry.module.id)) return entry.module.id;
    return entry.lesson.wovenAfter === undefined
      ? undefined
      : resolve(entry.lesson.wovenAfter, seen);
  };
  return new Map(
    [...entries.values()].map(({ module, lesson }) => [
      lesson.id,
      resolve(lesson.id, new Set()) ?? module.id,
    ]),
  );
}
