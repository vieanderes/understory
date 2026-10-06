import { formatMinutes } from '@/core/insight';
import type { CourseTree } from './custom';

/*
 * The words and sums the path builder shows. Kept apart from the screen so the meta lines,
 * the summary and the "has anything changed" rule can be tested without a DOM.
 */

type Part = CourseTree['parts'][number];
type Chapter = Part['chapters'][number];

export function partLessonIds(part: Part): string[] {
  return part.chapters.flatMap((c) => c.lessons.map((l) => l.id));
}

export function allLessonIds(tree: CourseTree): string[] {
  return tree.parts.flatMap(partLessonIds);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Lessons and minutes of the chosen lessons, in course order. */
export function totals(tree: CourseTree, chosen: ReadonlySet<string>) {
  const lessons = tree.parts
    .flatMap((p) => p.chapters.flatMap((c) => c.lessons))
    .filter((l) => chosen.has(l.id));
  return {
    lessonIds: lessons.map((l) => l.id),
    lessons: lessons.length,
    minutes: lessons.reduce((sum, l) => sum + l.minutes, 0),
  };
}

/** "24 lessons · about 4 h", or "Nothing chosen yet". */
export function totalsLine(lessons: number, minutes: number): string {
  if (lessons === 0) return 'Nothing chosen yet';
  return `${plural(lessons, 'lesson', 'lessons')} · about ${formatMinutes(minutes)}`;
}

/** The meta line under a part: its size, or how much of it is chosen. */
export function partMeta(part: Part, chosen: ReadonlySet<string>): string {
  const lessons = part.chapters.flatMap((c) => c.lessons);
  const picked = lessons.filter((l) => chosen.has(l.id));
  if (picked.length > 0 && picked.length < lessons.length) {
    return `${picked.length} of ${lessons.length} lessons chosen`;
  }
  const minutes = lessons.reduce((sum, l) => sum + l.minutes, 0);
  return [
    plural(part.chapters.length, 'chapter', 'chapters'),
    plural(lessons.length, 'lesson', 'lessons'),
    `about ${formatMinutes(minutes)}`,
  ].join(' · ');
}

/** The meta line under a chapter: "11 lessons · 1 h 50 min", or "4 of 11 chosen". */
export function chapterMeta(chapter: Chapter, chosen: ReadonlySet<string>): string {
  const picked = chapter.lessons.filter((l) => chosen.has(l.id)).length;
  const total = chapter.lessons.length;
  if (picked > 0 && picked < total) return `${picked} of ${total} chosen`;
  const minutes = chapter.lessons.reduce((sum, l) => sum + l.minutes, 0);
  return `${plural(total, 'lesson', 'lessons')} · ${formatMinutes(minutes)}`;
}

export interface SummaryPart {
  id: string;
  title: string;
  chapters: { id: string; title: string; chosen: number; total: number }[];
}

/** The chosen chapters in course order, grouped under their parts, each with n of m. */
export function summary(tree: CourseTree, chosen: ReadonlySet<string>): SummaryPart[] {
  return tree.parts.flatMap((part) => {
    const chapters = part.chapters.flatMap((c) => {
      const n = c.lessons.filter((l) => chosen.has(l.id)).length;
      return n === 0 ? [] : [{ id: c.id, title: c.title, chosen: n, total: c.lessons.length }];
    });
    return chapters.length === 0 ? [] : [{ id: part.id, title: part.title, chapters }];
  });
}

/**
 * A glimpse of what a level holds, so a row says what is inside before it is opened: the
 * first few names, and how many more there are.
 */
export function preview(names: readonly string[], shown = 3): { names: string[]; more: number } {
  // One hidden name reads worse as "+ 1 more" than as the name itself.
  const take = names.length === shown + 1 ? names.length : shown;
  return { names: names.slice(0, take), more: Math.max(0, names.length - take) };
}

/** Whether two choices hold the same lessons, so Save waits for a real change. */
export function sameChoice(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}
