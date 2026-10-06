import { percent, scoreTallies } from '@/core/online-test/score';
import { GOAL_COPY } from '@/core/plan';
import type { CatalogFile } from '@/core/practice';
import { INTEREST_COPY } from '@/core/profile';
import type { ProgressState } from '@/core/progress';
import { CHOSEN_PATH } from '@/features/paths/current';
import { CUSTOM_PATH_ID } from '@/features/paths/custom';
import { onPath } from '@/features/paths/links';
import type { PathSummary } from '@/lib/content';
import type { LearnerSituation } from './app-guide';

/**
 * A path as Scout needs it: ids only. Titles and links come from the course index, which
 * loads with the panel, so the layout sends every page a few hundred bytes, not the paths.
 */
export interface PathIndexEntry {
  id: string;
  name: string;
  lessonIds: readonly string[];
}

/** What the layouts hand Scout on every page: each path's name and lesson ids. */
export function pathIndex(paths: readonly PathSummary[]): PathIndexEntry[] {
  return paths.map(({ id, name, lessonIds }) => ({ id, name, lessonIds }));
}

type SituationState = Pick<
  ProgressState,
  'plan' | 'profile' | 'completedLessons' | 'settings' | 'customPath' | 'onlineTests' | 'newsRead'
>;

function customPath(state: SituationState, catalog: CatalogFile | null): PathIndexEntry | null {
  if (!state.customPath) return null;
  const chosen = new Set(state.customPath);
  // The builder keeps a custom path in course order; the index is the course order.
  const ordered = catalog
    ? catalog.parts.flatMap((part) => part.lessons).filter((id) => chosen.has(id))
    : state.customPath;
  return { id: CUSTOM_PATH_ID, name: 'My path', lessonIds: ordered };
}

/**
 * The path the learner is on, as Learn picks it: the one they chose, else the path with the
 * most done that is not finished. The plan's own choice needs the plan catalogue, which
 * Scout does not load; the chosen path covers anyone who has opened Learn.
 */
function pathUnderWay(
  state: SituationState,
  paths: readonly PathIndexEntry[],
  catalog: CatalogFile | null,
): PathIndexEntry | undefined {
  const own = customPath(state, catalog);
  const all = own ? [own, ...paths] : paths;
  const chosen = all.find((p) => p.id === state.settings[CHOSEN_PATH]);
  if (chosen) return chosen;
  const done = (p: PathIndexEntry) =>
    p.lessonIds.filter((id) => state.completedLessons.has(id)).length;
  return all
    .filter((p) => done(p) > 0 && done(p) < p.lessonIds.length)
    .sort((a, b) => done(b) - done(a))[0];
}

export function learnerSituation({
  state,
  paths,
  catalog,
  due,
  latestNews,
}: {
  state: SituationState;
  paths: readonly PathIndexEntry[];
  catalog: CatalogFile | null;
  due?: number;
  latestNews?: string;
}): LearnerSituation {
  const situation: LearnerSituation = {
    interests: (state.profile?.interests ?? []).map((i) => INTEREST_COPY[i].label),
  };
  if (state.plan) situation.goal = GOAL_COPY[state.plan.goal].title;

  const path = pathUnderWay(state, paths, catalog);
  if (path) {
    const nextId = path.lessonIds.find((id) => !state.completedLessons.has(id));
    const lesson = nextId ? catalog?.lessons[nextId] : undefined;
    situation.path = {
      name: path.name,
      done: path.lessonIds.filter((id) => state.completedLessons.has(id)).length,
      total: path.lessonIds.length,
      ...(lesson
        ? {
            next: {
              title: lesson.title,
              href: onPath(`/learn/${lesson.moduleSlug}/${lesson.slug}`, path.id),
            },
          }
        : {}),
    };
  }
  if (due !== undefined) situation.due = due;

  const last = state.onlineTests.at(-1);
  if (last) situation.lastTest = { title: last.title, score: percent(scoreTallies(last.tasks)) };

  if (latestNews) situation.news = { date: latestNews, read: state.newsRead.has(latestNews) };
  return situation;
}
