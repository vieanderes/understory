import type { PlanState } from '@/features/plan/usePlan';
import type { PathSummary } from '@/lib/content';
import { onPath } from './links';

/** The setting that holds a path the learner picked themselves on Learn. */
export const CHOSEN_PATH = 'learn.path';

/**
 * The path a learner is on: one they picked on Learn, else the one holding their plan's next
 * lesson, else the path with the most done that is not finished. Undefined when nothing
 * points anywhere yet, so the screen can ask instead of guessing.
 */
export function currentPath(
  paths: readonly PathSummary[],
  planState: Pick<PlanState, 'progress'>,
  isDone: (lessonId: string) => boolean,
  chosen?: unknown,
): PathSummary | undefined {
  const picked = paths.find((p) => p.id === chosen);
  if (picked) return picked;
  const item = planState.progress?.next?.item;
  if (item?.kind === 'lesson') {
    const planned = paths.find((p) => p.lessonIds.includes(item.id));
    if (planned) return planned;
  }
  return paths
    .map((path) => ({ path, done: path.lessonIds.filter(isDone).length }))
    .filter((s) => s.done > 0 && s.done < s.path.lessonIds.length)
    .sort((a, b) => b.done - a.done)[0]?.path;
}

/** The next lesson on a path, linked so the lesson knows which path it was opened from. */
export function nextOnPath(path: PathSummary, isDone: (lessonId: string) => boolean) {
  const lesson = path.stages.flatMap((s) => s.lessons).find((l) => !isDone(l.id));
  if (!lesson?.href) return undefined;
  const position = path.lessonIds.indexOf(lesson.id) + 1;
  return {
    title: lesson.title,
    href: onPath(lesson.href, path.id),
    minutes: lesson.minutes,
    where: `${path.name} · lesson ${position} of ${path.lessonIds.length}`,
  };
}
