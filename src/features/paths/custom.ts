import type { Manifest } from '@/core/content/compiled';
import { LAB_INFO, LAB_MINUTES } from '@/core/labs/catalog';
import type { PathTest } from '@/core/online-test/path-tests';
import type { PathStage, PathSummary } from '@/lib/content';

/** The course as the custom-path builder shows it: parts, their chapters, their lessons. */
export interface CourseTree {
  parts: {
    id: string;
    title: string;
    /** One sentence: what the part leaves you able to do. */
    summary: string;
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
      summary: part.summary,
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
const chapterOf = (lessonId: string) => lessonId.split('.')[0] ?? lessonId;

/**
 * The tests and labs that belong to each chapter. A written path's stage lists the tests
 * its lessons prepare for; they go to the chapter most of those lessons come from. A lab
 * names the chapter that teaches its mechanism. Each appears once per chapter.
 */
function tryItByChapter(written: readonly PathSummary[]): Map<string, PathTest[]> {
  const byChapter = new Map<string, PathTest[]>();
  const add = (chapter: string, test: PathTest) => {
    const list = byChapter.get(chapter) ?? [];
    if (!list.some((t) => t.key === test.key)) list.push(test);
    byChapter.set(chapter, list);
  };
  for (const lab of LAB_INFO) {
    add(lab.moduleId, {
      key: `lab:${lab.id}`,
      kind: 'lab',
      title: lab.title,
      detail: lab.question,
      minutes: LAB_MINUTES,
      href: `/labs/${lab.id}`,
      xp: 0,
    });
  }
  for (const path of written) {
    for (const stage of path.stages) {
      const tests = (stage.tests ?? []).filter((t) => t.kind !== 'lab');
      if (tests.length === 0) continue;
      const counts = new Map<string, number>();
      for (const l of stage.lessons)
        counts.set(chapterOf(l.id), (counts.get(chapterOf(l.id)) ?? 0) + 1);
      const home = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (home) for (const t of tests) add(home, t);
    }
  }
  return byChapter;
}

export function customPathSummary(
  tree: CourseTree,
  lessonIds: readonly string[],
  written: readonly PathSummary[] = [],
): PathSummary {
  const chosen = new Set(lessonIds);
  const tryIt = tryItByChapter(written);
  const stages: PathStage[] = tree.parts.flatMap((part) =>
    part.chapters.flatMap((chapter) => {
      const lessons = chapter.lessons.filter((l) => chosen.has(l.id));
      if (lessons.length === 0) return [];
      return [
        {
          title: chapter.title,
          why: part.title,
          lectureHref: `/lectures/${chapter.slug}`,
          tests: tryIt.get(chapter.id) ?? [],
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
