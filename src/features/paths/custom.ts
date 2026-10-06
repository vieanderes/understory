import type { Manifest } from '@/core/content/compiled';
import type { PathStage, PathSummary } from '@/lib/content';

/** The course as the custom-path builder shows it: parts, their chapters, their lessons. */
export interface CourseTree {
  parts: {
    id: string;
    title: string;
    chapters: {
      id: string;
      slug: string;
      title: string;
      lessons: { id: string; title: string; objective: string; minutes: number; href: string }[];
    }[];
  }[];
}

export const CUSTOM_PATH_ID = 'custom';

export function courseTree(manifest: Manifest): CourseTree {
  const chapters = new Map(manifest.modules.map((m) => [m.id, m]));
  return {
    parts: manifest.parts.map((part) => ({
      id: part.id,
      title: part.title,
      chapters: part.modules.flatMap((id) => {
        const chapter = chapters.get(id);
        if (!chapter) return [];
        return [
          {
            id: chapter.id,
            slug: chapter.slug,
            title: chapter.title,
            lessons: chapter.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              objective: l.objective,
              minutes: l.minutes,
              href: `/learn/${chapter.slug}/${l.slug}`,
            })),
          },
        ];
      }),
    })),
  };
}

/**
 * A learner's own path as a path like any other: one stage per chapter they chose from, in
 * course order, so Learn shows it with the same page, progress and links.
 */
export function customPathSummary(tree: CourseTree, lessonIds: readonly string[]): PathSummary {
  const chosen = new Set(lessonIds);
  const stages: PathStage[] = tree.parts.flatMap((part) =>
    part.chapters.flatMap((chapter) => {
      const lessons = chapter.lessons.filter((l) => chosen.has(l.id));
      if (lessons.length === 0) return [];
      return [
        {
          title: chapter.title,
          why: part.title,
          lectureHref: `/lectures/${chapter.slug}`,
          lessons: lessons.map(({ id, title, objective, minutes, href }) => ({
            id,
            title,
            objective,
            minutes,
            href,
          })),
          optional: [],
        },
      ];
    }),
  );
  const lessons = stages.flatMap((s) => s.lessons);
  return {
    id: CUSTOM_PATH_ID,
    name: 'My path',
    title: 'My path',
    promise: 'The lessons you chose, in course order.',
    summary: '',
    outcomes: [],
    method: [],
    shapes: [],
    practice: [],
    readyWhen: [],
    stages,
    lessonIds: lessons.map((l) => l.id),
    minutes: lessons.reduce((sum, l) => sum + l.minutes, 0),
  };
}
