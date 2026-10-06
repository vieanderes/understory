import type { PlanState } from '@/features/plan/usePlan';
import type { PathSummary } from '@/lib/content';
import { onPath } from './links';

/** The setting that holds the paths the learner picked on Learn, comma-separated, in order. */
export const CHOSEN_PATH = 'learn.path';

/** The chosen path ids, in the order chosen. A single id from before reads the same way. */
export function chosenPathIds(setting: unknown): string[] {
  if (typeof setting !== 'string') return [];
  return setting.split(',').filter((id) => id.length > 0);
}

/** The setting value after a tap on one path: added at the end, or removed. */
export function togglePath(chosen: readonly string[], id: string): string {
  return (chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]).join(',');
}

/** The chosen paths that exist, in the order chosen. */
export function chosenPaths(paths: readonly PathSummary[], setting: unknown): PathSummary[] {
  return chosenPathIds(setting).flatMap((id) => paths.find((p) => p.id === id) ?? []);
}

/**
 * The path a learner is on: the first unfinished one of those they picked on Learn (several
 * are worked through in the order chosen), else the one holding their plan's next lesson,
 * else the path with the most done that is not finished. Undefined when nothing points
 * anywhere yet, so the screen can ask instead of guessing.
 */
export function currentPath(
  paths: readonly PathSummary[],
  planState: Pick<PlanState, 'progress'>,
  isDone: (lessonId: string) => boolean,
  chosen?: unknown,
): PathSummary | undefined {
  const picked = chosenPaths(paths, chosen);
  const open = picked.find((p) => p.lessonIds.some((id) => !isDone(id)));
  if (open ?? picked[0]) return open ?? picked[0];
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
