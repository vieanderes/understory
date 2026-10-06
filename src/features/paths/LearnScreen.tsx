'use client';

import { ArrowRight, ChevronDown, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import type { PlanCatalog } from '@/core/plan';
import { usePlan } from '@/features/plan/usePlan';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { CHOSEN_PATH, currentPath } from './current';
import { CUSTOM_PATH_ID, customPathSummary, type CourseTree } from './custom';
import { PathView } from './PathView';

/** Every path, one tap to make it yours. Folded away once a path is under way. */
function PathPicker({
  paths,
  current,
}: {
  paths: readonly PathSummary[];
  current: string | undefined;
}) {
  const store = useStore();
  return (
    <ul className="border-border rounded-panel bg-surface divide-border divide-y overflow-hidden border">
      {paths.map((path) => {
        const on = path.id === current;
        return (
          <li key={path.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() =>
                void store.record('setting_changed', { key: CHOSEN_PATH, value: path.id })
              }
              className={cn(
                'hover:bg-raised flex min-h-6 w-full flex-col items-start gap-0.5 p-2 text-left transition-colors duration-150 ease-out md:px-3',
                on && 'bg-raised',
              )}
            >
              <span className={cn('font-medium', on && 'font-semibold')}>{path.name}</span>
              <span className="text-muted text-sm">{path.decision ?? path.promise}</span>
            </button>
          </li>
        );
      })}
      <li>
        <Link
          href="/learn/build"
          className="hover:bg-raised flex min-h-6 w-full items-center gap-1 p-2 transition-colors duration-150 ease-out md:px-3"
        >
          <ListChecks aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Build your own path</span>
            <span className="text-muted block text-sm">
              Choose parts, chapters or single lessons from the whole course.
            </span>
          </span>
        </Link>
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
            Pick a path.
          </h1>
          <p data-arrive="rise" className="text-muted prose-measure text-lg">
            Each one takes you through the lessons for one goal, with tests along the way and a
            certificate at the end.
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
