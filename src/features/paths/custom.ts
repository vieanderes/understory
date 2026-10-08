import type { Manifest } from '@/core/content/compiled';
import { LAB_INFO, LAB_MINUTES } from '@/core/labs/catalog';
import type { PathTest } from '@/core/online-test/path-tests';
import type { OwnPath } from '@/core/progress';
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
      lessons: {
        id: string;
        title: string;
        objective: string;
        minutes: number;
        href: string;
        /** What the lesson teaches, so placement can say it is already known. */
        concepts: string[];
      }[];
    }[];
  }[];
}

/** The one own path from before own paths had names. New ones get `newOwnPathId()`. */
export const CUSTOM_PATH_ID = 'custom';

export const isOwnPathId = (id: string): boolean => id === CUSTOM_PATH_ID || id.startsWith('own-');

/** `own-` and 8 characters: never a written track's id, and unique enough per learner. */
export function newOwnPathId(): string {
  return `own-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

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
              concepts: l.concepts,
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

type TreeLesson = CourseTree['parts'][number]['chapters'][number]['lessons'][number];

interface Located {
  lesson: TreeLesson;
  chapter: CourseTree['parts'][number]['chapters'][number];
  part: CourseTree['parts'][number];
}

function locate(tree: CourseTree): Map<string, Located> {
  const found = new Map<string, Located>();
  for (const part of tree.parts)
    for (const chapter of part.chapters)
      for (const lesson of chapter.lessons) found.set(lesson.id, { lesson, chapter, part });
  return found;
}

const pathLesson = ({ id, title, objective, minutes, href, concepts }: TreeLesson) => ({
  id,
  title,
  objective,
  minutes,
  href,
  concepts,
});

/** One stage per chapter the learner chose from, in course order: a path built by ticking. */
function chapterStages(
  tree: CourseTree,
  chosen: ReadonlySet<string>,
  tryIt: Map<string, PathTest[]>,
): PathStage[] {
  return tree.parts.flatMap((part) =>
    part.chapters.flatMap((chapter) => {
      const lessons = chapter.lessons.filter((l) => chosen.has(l.id));
      if (lessons.length === 0) return [];
      return [
        {
          title: chapter.title,
          why: part.title,
          lectureHref: `/lectures/${chapter.slug}`,
          tests: tryIt.get(chapter.id) ?? [],
          lessons: lessons.map(pathLesson),
          optional: [],
        },
      ];
    }),
  );
}

/**
 * The stages as planned. A stage gets its chapter's lecture and tests when its lessons are
 * mostly from one chapter. Lessons no longer in the course are skipped, and a stage left
 * empty goes with them.
 */
function plannedStages(
  stages: NonNullable<OwnPath['stages']>,
  found: Map<string, Located>,
  tryIt: Map<string, PathTest[]>,
): PathStage[] {
  return stages.flatMap((stage) => {
    const located = stage.lessonIds.flatMap((id) => found.get(id) ?? []);
    if (located.length === 0) return [];
    const counts = new Map<string, number>();
    for (const l of located) counts.set(l.chapter.id, (counts.get(l.chapter.id) ?? 0) + 1);
    const [home, count = 0] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const chapter = located.find((l) => l.chapter.id === home)?.chapter;
    const mostly = chapter && count * 2 > located.length;
    return [
      {
        title: stage.title,
        why: stage.why ?? '',
        ...(mostly ? { lectureHref: `/lectures/${chapter.slug}` } : {}),
        tests: mostly ? (tryIt.get(chapter.id) ?? []) : [],
        lessons: located.map((l) => pathLesson(l.lesson)),
        optional: [],
        ...(stage.milestone ? { milestone: stage.milestone } : {}),
      },
    ];
  });
}

/**
 * Keeps a planned path's stages when its lessons change in the builder: lessons taken out
 * leave their stage, and lessons added go to a last stage of their own.
 */
export function restage(
  stages: OwnPath['stages'],
  lessonIds: readonly string[],
): OwnPath['stages'] {
  if (!stages) return undefined;
  const chosen = new Set(lessonIds);
  const kept = stages
    .map((s) => ({ ...s, lessonIds: s.lessonIds.filter((id) => chosen.has(id)) }))
    .filter((s) => s.lessonIds.length > 0);
  const staged = new Set(kept.flatMap((s) => s.lessonIds));
  const added = lessonIds.filter((id) => !staged.has(id));
  return added.length > 0 ? [...kept, { title: 'Added lessons', lessonIds: added }] : kept;
}

/** A learner's own path as a path like any other, so Learn shows it with the same page. */
export function ownPathSummary(
  tree: CourseTree,
  own: Pick<OwnPath, 'id' | 'name' | 'lessonIds'> &
    Partial<Pick<OwnPath, 'stages' | 'summary' | 'destination' | 'baseline' | 'cut'>>,
  written: readonly PathSummary[] = [],
): PathSummary {
  const tryIt = tryItByChapter(written);
  const stages = own.stages
    ? plannedStages(own.stages, locate(tree), tryIt)
    : chapterStages(tree, new Set(own.lessonIds), tryIt);
  const lessons = stages.flatMap((s) => s.lessons);
  return {
    id: own.id,
    name: own.name,
    title: own.name,
    promise:
      own.summary ||
      (own.stages
        ? 'Planned with Scout, in the order planned.'
        : 'The lessons you chose, in course order.'),
    summary: '',
    outcomes: [],
    method: [],
    shapes: [],
    practice: [],
    readyWhen: [],
    stages,
    ...(own.destination ? { destination: own.destination } : {}),
    ...(own.baseline ? { baseline: own.baseline } : {}),
    ...(own.cut?.length ? { cut: own.cut } : {}),
    lessonIds: lessons.map((l) => l.id),
    minutes: lessons.reduce((sum, l) => sum + l.minutes, 0),
  };
}

/** The learner's own paths first, in the order they were made, then the written ones. */
export function withOwnPaths(
  tree: CourseTree,
  ownPaths: ReadonlyMap<string, OwnPath>,
  written: readonly PathSummary[],
): PathSummary[] {
  return [...[...ownPaths.values()].map((own) => ownPathSummary(tree, own, written)), ...written];
}
