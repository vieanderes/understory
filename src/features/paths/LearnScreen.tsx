'use client';

import { ArrowRight, ChevronDown, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { formatMinutes } from '@/core/insight';
import type { PlanCatalog } from '@/core/plan';
import { usePlan } from '@/features/plan/usePlan';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { CHOSEN_PATH, currentPath } from './current';
import { CUSTOM_PATH_ID, customPathSummary, type CourseTree } from './custom';
import { PathView } from './PathView';

/** A path as a card: what it gets you, its stages, its size, and two clear actions. */
function PathCard({
  path,
  current,
  done,
  onChoose,
}: {
  path: PathSummary;
  current: boolean;
  done: number;
  onChoose: () => void;
}) {
  const total = path.lessonIds.length;
  const stages = path.stages.map((s) => s.title);
  return (
    <li
      className={cn(
        'rounded-panel bg-surface flex flex-col gap-2 border p-2 md:p-3',
        current ? 'border-fg' : 'border-border',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">{path.name}</h3>
          {current ? <span className="t-label shrink-0">Your path</span> : null}
        </div>
        <p className="text-muted text-sm">{path.promise}</p>
      </div>
      {stages.length > 0 ? (
        <ol className="flex flex-col gap-0.5 text-sm">
          {stages.map((title, i) => (
            <li key={title} className="flex gap-1">
              <span className="t-figure text-faint w-2 shrink-0">{i + 1}</span>
              <span className="min-w-0">{title}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-auto flex flex-col gap-1.5 pt-1">
        {done > 0 ? (
          <ProgressLine value={done / Math.max(1, total)} label={`${path.name} done`} />
        ) : null}
        <p className="t-figure text-muted text-sm">
          {done > 0 ? `${done} of ${total} lessons` : `${total} lessons`} · about{' '}
          {formatMinutes(path.minutes)}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {current ? null : (
            <button type="button" onClick={onChoose} className={buttonClass('secondary', 'md')}>
              Choose this path
            </button>
          )}
          <Link href={`/paths/${path.id}`} className={buttonClass('quiet', 'md')}>
            See the stages
          </Link>
        </div>
      </div>
    </li>
  );
}

/** Every path as a card, then building your own. Choosing one makes it Learn's path. */
function PathPicker({
  paths,
  current,
}: {
  paths: readonly PathSummary[];
  current: string | undefined;
}) {
  const store = useStore();
  const { status, state } = useProgress();
  const doneOf = (path: PathSummary) =>
    status === 'ready' ? path.lessonIds.filter((id) => state.completedLessons.has(id)).length : 0;
  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {paths.map((path) => (
        <PathCard
          key={path.id}
          path={path}
          current={path.id === current}
          done={doneOf(path)}
          onChoose={() =>
            void store.record('setting_changed', { key: CHOSEN_PATH, value: path.id })
          }
        />
      ))}
      <li className="rounded-panel border-border flex flex-col gap-2 border p-2 md:p-3">
        <ListChecks aria-hidden size={24} strokeWidth={2} className="text-muted" />
        <div className="flex flex-col gap-0.5">
          <h3 className="text-lg font-semibold">Build your own path</h3>
          <p className="text-muted text-sm">
            Choose whole parts, single chapters or just the lessons you want, from the whole course.
          </p>
        </div>
        <div className="mt-auto pt-1">
          <Link href="/learn/build" className={buttonClass('secondary', 'md')}>
            Build my path
          </Link>
        </div>
      </li>
    </ul>
  );
}

/**
 * Learn is your path. With one under way (picked here, set by the plan, or simply the one
 * with the most done) it opens straight on it, with a quiet way to switch. Without one it
 * asks once: set up, or pick a path.
 */
export function LearnScreen({
  paths: written,
  catalog,
  tree,
}: {
  paths: readonly PathSummary[];
  catalog: PlanCatalog;
  tree: CourseTree;
}) {
  const { status, state } = useProgress();
  const planState = usePlan(catalog);
  if (status !== 'ready') return <p className="text-muted py-4">Reading your progress...</p>;
  const isDone = (id: string) => state.completedLessons.has(id);
  // A path the learner built sits first, as one of theirs.
  const paths = state.customPath
    ? [customPathSummary(tree, state.customPath), ...written]
    : written;
  const path = currentPath(paths, planState, isDone, state.settings[CHOSEN_PATH]);

  if (!path) {
    const setUp = !state.plan && !state.profile;
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="t-title" data-arrive="title">
            Choose a path.
          </h1>
          <p data-arrive="rise" className="text-muted prose-measure text-lg">
            Short lessons for one goal, with practice and tests along the way.
          </p>
          {setUp ? (
            <div data-arrive="rise" className="flex flex-wrap items-center gap-1 pt-1">
              <Link href="/plan" className={buttonClass('primary')}>
                Help me choose · 1 minute
                <ArrowRight aria-hidden size={16} strokeWidth={2} />
              </Link>
            </div>
          ) : null}
        </header>
        <PathPicker paths={paths} current={undefined} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/progress?scope=path"
        className="text-muted hover:text-fg inline-flex min-h-5 w-fit items-center gap-0.5 text-sm font-medium underline-offset-4 hover:underline"
      >
        Progress on this path
        <ArrowRight aria-hidden size={16} strokeWidth={2} />
      </Link>
      <details className="group">
        <summary className="text-muted hover:text-fg rounded-control inline-flex min-h-5 cursor-pointer items-center gap-0.5 text-sm font-medium transition-colors duration-150 ease-out">
          Switch path
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={2}
            className="transition-transform duration-150 ease-out group-open:rotate-180"
          />
        </summary>
        <div className="pt-1">
          <PathPicker paths={paths} current={path.id} />
        </div>
      </details>
      <PathView path={path} embedded custom={path.id === CUSTOM_PATH_ID} />
    </div>
  );
}
