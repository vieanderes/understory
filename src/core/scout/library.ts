import * as z from '@/core/zod';

/*
 * The Librarian (docs/SCOUT-ROLES.md, section 5): Scout recommends only references the course
 * already carries, best first, and never invents one. The library is built with the site; the
 * tab sends Scout a slice of it, since all of it would not fit a prompt.
 */

export interface LibrarySource {
  kind: 'paper' | 'spec' | 'rfc' | 'book' | 'essay' | 'docs' | 'talk' | 'source';
  title: string;
  authors?: string;
  year?: number;
  venue?: string;
  url?: string;
  note?: string;
  primary?: boolean;
  verified: boolean;
}

export interface LibraryEntry extends Omit<LibrarySource, 'primary'> {
  /** `<lessonId>#r<n>`, stable while the lesson's references keep their order. */
  id: string;
  primary: boolean;
  lessonId: string;
  moduleId: string;
}

export function libraryEntries(
  lessons: readonly { id: string; moduleId: string; references: readonly LibrarySource[] }[],
): LibraryEntry[] {
  return lessons.flatMap((lesson) =>
    lesson.references.map((ref, i) => ({
      ...ref,
      id: `${lesson.id}#r${i + 1}`,
      primary: ref.primary ?? false,
      lessonId: lesson.id,
      moduleId: lesson.moduleId,
    })),
  );
}

export const LIBRARY_SLICE = 30;

/** Primary before the rest, then checked before unchecked; otherwise course order. */
const rank = (e: LibraryEntry) => (e.primary ? 0 : 2) + (e.verified ? 0 : 1);

/**
 * What Scout sees of the library: the lesson's references first, then those of the chapters
 * given (the lesson's own, or the learner's path), each group best first.
 */
export function librarySlice(
  entries: readonly LibraryEntry[],
  where: { lessonId?: string; moduleIds: readonly string[] },
  max = LIBRARY_SLICE,
): LibraryEntry[] {
  const best = (list: LibraryEntry[]) => list.sort((a, b) => rank(a) - rank(b));
  const own = where.lessonId ? best(entries.filter((e) => e.lessonId === where.lessonId)) : [];
  const chapters = where.moduleIds.flatMap((m) =>
    best(entries.filter((e) => e.moduleId === m && e.lessonId !== where.lessonId)),
  );
  return [...own, ...chapters].slice(0, max);
}

export function libraryText(entries: readonly LibraryEntry[]): string {
  return entries
    .map((e) => {
      const byline = [e.authors, e.year].filter(Boolean).join(', ');
      return [
        `[${e.id}] ${e.kind}`,
        e.title,
        ...(byline ? [byline] : []),
        ...(e.primary ? ['primary'] : []),
        ...(e.note ? [e.note] : []),
        ...(e.verified ? [] : ['not yet checked by a person']),
      ].join(' · ');
    })
    .join('\n');
}

/** What the learner's path leaves out on purpose, so the Librarian can hold the line. */
export function cutText(cut: readonly { what: string; why: string; later: boolean }[]): string {
  if (cut.length === 0) return '';
  return [
    'Their path leaves out on purpose:',
    ...cut.map((c) => `- ${c.what} (${c.later ? 'for now' : 'not needed'}): ${c.why}`),
  ].join('\n');
}

export const READING_FENCE = 'scout-reading';

export const readingBlockSchema = z.object({
  items: z
    .array(
      z.object({ id: z.string().trim().min(1).max(120), why: z.string().trim().min(1).max(240) }),
    )
    .min(1)
    .max(3),
});
export type ReadingBlock = z.infer<typeof readingBlockSchema>;

export function parseReadingBlock(body: string): ReadingBlock | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = readingBlockSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
