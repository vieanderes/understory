'use client';

import { ArrowRight, Check, ChevronDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { rowArrow, rowItem, rowList } from '@/components/ui/rows';
import { formatMinutes } from '@/core/insight';
import type { PlanCatalog } from '@/core/plan';
import { usePathExam } from '@/features/exam/usePathExam';
import { usePlan } from '@/features/plan/usePlan';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { CHOSEN_PATH, chosenPathIds, chosenPaths, currentPath, togglePath } from './current';
import { CUSTOM_PATH_ID, customPathSummary, type CourseTree } from './custom';
import { PathView } from './PathView';

/**
 * A path as a hairline row that toggles. The marker holds its place in the order chosen,
 * so a learner on two paths sees which comes first. "See the stages" stays a separate,
 * quieter link, so choosing never navigates away.
 */
function PathRow({
  path,
  order,
  done,
  onToggle,
}: {
  path: PathSummary;
  /** 1-based place among the chosen paths, or 0 when not chosen. */
  order: number;
  done: number;
  onToggle: () => void;
}) {
  const exam = usePathExam(path.id);
  const total = path.lessonIds.length;
  const chosen = order > 0;
  const custom = path.id === CUSTOM_PATH_ID;
  return (
    <li className={cn(rowItem, 'flex items-start gap-1')}>
      <button
        type="button"
        aria-pressed={chosen}
        onClick={onToggle}
        className="group rounded-control transition-press hover:bg-raised -ml-0.5 flex min-h-6 min-w-0 flex-1 items-start gap-1.5 py-1.5 pr-0.5 pl-0.5 text-left select-none active:scale-98"
      >
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-2.5 shrink-0 items-center justify-center rounded-full border text-sm transition-colors duration-150 ease-out',
            chosen
              ? 'bg-fg border-fg text-bg'
              : 'border-border-strong group-hover:border-fg text-transparent',
          )}
        >
          {chosen ? <span className="t-figure font-semibold">{order}</span> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={chosen ? 'font-semibold' : 'font-medium'}>{path.name}</span>
          <span className="text-muted text-sm">{path.promise}</span>
          <span className="t-figure text-muted pt-0.5 text-sm">
            {done > 0 ? `${done}/${total} lessons` : `${total} lessons`} · about{' '}
            {formatMinutes(path.minutes)}
            {exam.passed ? (
              <span className="text-fg inline-flex items-center gap-0.5 pl-1 font-medium">
                <Check aria-hidden size={16} strokeWidth={2} />
                Certified
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <Link
        href={custom ? '/learn/build' : `/paths/${path.id}`}
        aria-label={custom ? 'Change my path' : `See the stages: ${path.name}`}
        className="text-muted hover:text-fg rounded-control mt-1 inline-flex h-5 shrink-0 items-center px-1 text-sm font-medium transition-colors duration-150 ease-out"
      >
        {custom ? 'Change' : 'See the stages'}
      </Link>
    </li>
  );
}

/** Every path as a hairline row, any number chosen, then building your own. */
function PathPicker({ paths, titleId }: { paths: readonly PathSummary[]; titleId: string }) {
  const store = useStore();
  const { status, state } = useProgress();
  const chosen = chosenPathIds(state.settings[CHOSEN_PATH]);
  const doneOf = (path: PathSummary) =>
    status === 'ready' ? path.lessonIds.filter((id) => state.completedLessons.has(id)).length : 0;
  const hasCustom = paths.some((p) => p.id === CUSTOM_PATH_ID);
  return (
    <div role="group" aria-labelledby={titleId}>
      <ul className={rowList()}>
        {paths.map((path) => (
          <PathRow
            key={path.id}
            path={path}
            order={chosen.indexOf(path.id) + 1}
            done={doneOf(path)}
            onToggle={() =>
              void store.record('setting_changed', {
                key: CHOSEN_PATH,
                value: togglePath(chosen, path.id),
              })
            }
          />
        ))}
        {hasCustom ? null : (
          <li className={rowItem}>
            <Link
              href="/learn/build"
              className="group rounded-control transition-press hover:bg-raised -mx-0.5 flex min-h-6 items-start gap-1.5 px-0.5 py-1.5 select-none active:scale-98"
            >
              <span
                aria-hidden
                className="border-border-strong text-muted group-hover:border-fg group-hover:text-fg mt-0.5 flex size-2.5 shrink-0 items-center justify-center rounded-full border border-dashed transition-colors duration-150 ease-out"
              >
                <Plus size={12} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">Build your own path</span>
                <span className="text-muted text-sm">
                  Whole parts, single chapters or just the lessons you want
                </span>
              </span>
              <ArrowRight
                aria-hidden
                size={16}
                strokeWidth={2}
                className={cn(rowArrow, 'mt-0.5')}
              />
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * One tab per chosen path, when there is more than one. The choice lives in `?path=`, so a
 * link or a reload lands on the same path.
 */
function PathTabs({
  paths,
  shown,
  isDone,
}: {
  paths: readonly PathSummary[];
  shown: string;
  isDone: (id: string) => boolean;
}) {
  return (
    <nav aria-label="Your paths" className="border-border border-b">
      <ul className="flex flex-wrap gap-x-3">
        {paths.map((path) => {
          const active = path.id === shown;
          const done = path.lessonIds.filter(isDone).length;
          return (
            <li key={path.id}>
              <Link
                href={`/paths?path=${path.id}`}
                replace
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex h-6 items-center gap-1 border-b-2 transition-colors duration-150 ease-out',
                  active
                    ? 'border-fg text-fg font-semibold'
                    : 'text-muted hover:text-fg border-transparent font-medium',
                )}
              >
                {path.name}
                <span className="t-figure text-muted text-sm font-normal">
                  {done}/{path.lessonIds.length}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Learn is your path. With one under way (picked here, set by the plan, or simply the one
 * with the most done) it opens straight on it, with a quiet way to change the choice. With
 * several chosen, a tab row switches between them. Without one it asks once.
 */
function Learn({
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
  const asked = useSearchParams().get('path');
  const [switching, setSwitching] = useState(false);
  if (status !== 'ready') return <p className="text-muted py-4">Reading your progress...</p>;
  const isDone = (id: string) => state.completedLessons.has(id);
  // A path the learner built sits first, as one of theirs.
  const paths = state.customPath
    ? [customPathSummary(tree, state.customPath), ...written]
    : written;
  const setting = state.settings[CHOSEN_PATH];
  const chosen = chosenPaths(paths, setting);
  const current = currentPath(paths, planState, isDone, setting);
  const path = chosen.find((p) => p.id === asked) ?? current;

  if (!path) {
    const setUp = !state.plan && !state.profile;
    return (
      <div className="flex max-w-5xl flex-col gap-6 md:pt-2">
        <header className="flex flex-col gap-1">
          <h1 id="pick-title" className="t-title" data-arrive="title">
            Choose one or more paths
          </h1>
          <p data-arrive="rise" className="text-muted text-lg">
            Short lessons for one goal, with practice and tests along the way.
          </p>
          {setUp ? (
            <div data-arrive="rise" className="pt-2">
              <Link href="/plan" className={buttonClass('primary')}>
                Help me choose · 1 minute
                <ArrowRight aria-hidden size={16} strokeWidth={2} />
              </Link>
            </div>
          ) : null}
        </header>
        <PathPicker paths={paths} titleId="pick-title" />
      </div>
    );
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4 md:pt-2">
      {chosen.length > 1 ? <PathTabs paths={chosen} shown={path.id} isDone={isDone} /> : null}
      <PathView
        path={path}
        embedded
        custom={path.id === CUSTOM_PATH_ID}
        tools={
          <button
            type="button"
            aria-expanded={switching}
            onClick={() => setSwitching((open) => !open)}
            className={buttonClass('quiet', 'md', 'text-muted hover:text-fg')}
          >
            Switch path
            <ChevronDown
              aria-hidden
              size={16}
              strokeWidth={2}
              className={cn(
                'transition-transform duration-150 ease-out',
                switching && 'rotate-180',
              )}
            />
          </button>
        }
        drawer={
          switching ? (
            <section
              id="switch-path"
              aria-labelledby="switch-title"
              className="flex flex-col gap-2"
            >
              <h2 id="switch-title" className="t-section">
                Choose one or more paths
              </h2>
              <PathPicker paths={paths} titleId="switch-title" />
            </section>
          ) : null
        }
      />
    </div>
  );
}

export function LearnScreen(props: {
  paths: readonly PathSummary[];
  catalog: PlanCatalog;
  tree: CourseTree;
}) {
  // `?path=` is read on the client; the boundary keeps the rest of the page static.
  return (
    <Suspense fallback={<p className="text-muted py-4">Reading your progress...</p>}>
      <Learn {...props} />
    </Suspense>
  );
}
