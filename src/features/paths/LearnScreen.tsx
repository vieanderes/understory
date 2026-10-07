'use client';

import { ArrowRight, Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';
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
import { isOwnPathId, withOwnPaths, type CourseTree } from './custom';
import { FindLesson } from './FindLesson';
import { OwnPathTools, RemovedPathNotice } from './OwnPathTools';
import { PathView } from './PathView';

/** The tick a path row carries: an empty box, or ink with the path's place in the order. */
function OrderTick({ order }: { order: number }) {
  const chosen = order > 0;
  return (
    <span
      aria-hidden
      className={cn(
        'rounded-control mt-0.5 flex size-2.5 shrink-0 items-center justify-center border transition-colors duration-150 ease-out',
        chosen ? 'bg-fg border-fg text-bg' : 'bg-surface border-faint group-hover:border-fg',
      )}
    >
      {chosen ? <span className="t-figure text-sm leading-none font-semibold">{order}</span> : null}
    </span>
  );
}

/**
 * A path as a hairline row that toggles. The whole row is the toggle (the button stretches
 * over it); "See the stages" sits above that layer, so choosing never navigates away and
 * the link is still one tap. The tick holds the path's place in the order chosen.
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
  const custom = isOwnPathId(path.id);
  return (
    <li className={rowItem}>
      <div className={cn('hairline-row group relative flex items-start gap-1.5 py-1.5')}>
        <OrderTick order={order} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <button
              type="button"
              aria-pressed={chosen}
              onClick={onToggle}
              className={cn(
                'rounded-control min-w-0 text-left after:absolute after:inset-0',
                'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
                chosen ? 'font-semibold' : 'font-medium',
              )}
            >
              {path.name}
            </button>
            <span className="t-figure text-muted shrink-0 text-sm">
              {done > 0 ? `${done}/${total}` : total} lessons · {formatMinutes(path.minutes)}
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-muted line-clamp-2 text-sm">{path.promise}</p>
            {exam.passed ? (
              <span className="text-fg inline-flex shrink-0 items-center gap-0.5 text-sm font-medium">
                <Check aria-hidden size={16} strokeWidth={2} />
                Certified
              </span>
            ) : (
              <Link
                href={custom ? '/learn/build' : `/paths/${path.id}`}
                aria-label={custom ? 'Change my path' : `See the stages: ${path.name}`}
                className="text-muted hover:text-fg relative z-10 -mr-0.5 inline-flex shrink-0 items-center text-sm font-medium transition-colors duration-150 ease-out"
              >
                {custom ? 'Change' : 'Stages'}
                <ChevronRight aria-hidden size={16} strokeWidth={2} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Every path as a hairline row, any number chosen, then building your own. With `onToggle`
 * the choice is a draft the screen confirms; without it each tap saves at once.
 */
function PathPicker({
  paths,
  titleId,
  draft,
  onToggle,
}: {
  paths: readonly PathSummary[];
  titleId: string;
  draft?: readonly string[];
  onToggle?: (id: string) => void;
}) {
  const store = useStore();
  const { status, state } = useProgress();
  const chosen = draft ?? chosenPathIds(state.settings[CHOSEN_PATH]);
  const doneOf = (path: PathSummary) =>
    status === 'ready' ? path.lessonIds.filter((id) => state.completedLessons.has(id)).length : 0;
  const toggle = (id: string) =>
    onToggle
      ? onToggle(id)
      : void store.record('setting_changed', { key: CHOSEN_PATH, value: togglePath(chosen, id) });
  return (
    <div role="group" aria-labelledby={titleId}>
      <ul className={rowList()}>
        {paths.map((path) => (
          <PathRow
            key={path.id}
            path={path}
            order={chosen.indexOf(path.id) + 1}
            done={doneOf(path)}
            onToggle={() => toggle(path.id)}
          />
        ))}
        <li className={rowItem}>
          <Link
            href="/learn/build"
            className="hairline-row group flex items-start gap-1.5 py-1.5 transition-colors duration-150 ease-out"
          >
            <span
              aria-hidden
              className="rounded-control border-faint text-muted group-hover:border-fg group-hover:text-fg mt-0.5 flex size-2.5 shrink-0 items-center justify-center border border-dashed transition-colors duration-150 ease-out"
            >
              <Plus size={12} strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">Build your own path</span>
              <span className="text-muted text-sm">
                Parts, chapters or single lessons, by hand or with Scout
              </span>
            </span>
            <ArrowRight aria-hidden size={16} strokeWidth={2} className={cn(rowArrow, 'mt-0.5')} />
          </Link>
        </li>
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
    <nav aria-label="Chosen paths" className="border-border border-b">
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
  const store = useStore();
  const [switching, setSwitching] = useState(false);
  // On a first visit the choice is a draft, so several paths can be ticked before Start.
  const [draft, setDraft] = useState<string[]>([]);
  if (status !== 'ready') return <PathIndex paths={written} />;
  const isDone = (id: string) => state.completedLessons.has(id);
  // The paths the learner made sit first, as theirs.
  const paths = withOwnPaths(tree, state.ownPaths, written);
  const setting = state.settings[CHOSEN_PATH];
  const chosen = chosenPaths(paths, setting);
  const current = currentPath(paths, planState, isDone, setting);
  const path = chosen.find((p) => p.id === asked) ?? current;

  if (!path) {
    const setUp = !state.plan && !state.profile;
    const names = draft.flatMap((id) => paths.find((p) => p.id === id)?.name ?? []);
    return (
      <div className="flex max-w-5xl flex-col gap-6 md:pt-2">
        <RemovedPathNotice />
        <header className="flex flex-col gap-1">
          <h1 id="pick-title" className="t-title" data-arrive="title">
            Choose your paths
          </h1>
          <p data-arrive="rise" className="text-muted text-lg">
            Pick one or more. You work through them in the order you pick.
          </p>
          <div data-arrive="rise" className="flex flex-wrap gap-x-4">
            <Link
              href="/start"
              className="text-muted hover:text-fg inline-flex min-h-5 w-fit items-center gap-0.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              Not sure where you stand? Find your level
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
            {setUp ? (
              <Link
                href="/plan"
                className="text-muted hover:text-fg inline-flex min-h-5 w-fit items-center gap-0.5 text-sm font-medium underline-offset-4 hover:underline"
              >
                Or answer five questions
                <ArrowRight aria-hidden size={16} strokeWidth={2} />
              </Link>
            ) : null}
          </div>
        </header>
        <FindLesson tree={tree} />
        <PathPicker
          paths={paths}
          titleId="pick-title"
          draft={draft}
          onToggle={(id) =>
            setDraft((current) =>
              current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
            )
          }
        />
        {draft.length > 0 ? (
          // Floats once something is ticked, above the tab bar and clear of the assistant's
          // button in the corner, so Start is always in reach while choosing.
          <div className="bg-surface border-border rounded-panel shadow-float sticky bottom-10 flex items-center justify-between gap-2 border py-1.5 pr-8 pl-2 md:bottom-10 md:px-3">
            <p className="min-w-0 text-sm" aria-live="polite">
              <span className="font-medium">{names[0]}</span>
              {names.length > 1 ? (
                <span className="text-muted">, then {names.slice(1).join(', ')}</span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() =>
                void store.record('setting_changed', { key: CHOSEN_PATH, value: draft.join(',') })
              }
              className={buttonClass('primary', 'lg', 'shrink-0')}
            >
              Start learning
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4 md:pt-2">
      <RemovedPathNotice />
      {chosen.length > 1 ? <PathTabs paths={chosen} shown={path.id} isDone={isDone} /> : null}
      <FindLesson tree={tree} />
      <PathView
        path={path}
        embedded
        custom={isOwnPathId(path.id)}
        tools={
          <>
            {isOwnPathId(path.id) ? <OwnPathTools pathId={path.id} /> : null}
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
          </>
        }
        drawer={
          switching ? (
            <section
              id="switch-path"
              aria-labelledby="switch-title"
              className="flex flex-col gap-2"
            >
              <h2 id="switch-title" className="t-section">
                Choose your paths
              </h2>
              <PathPicker paths={paths} titleId="switch-title" />
            </section>
          ) : null
        }
      />
    </div>
  );
}

/**
 * What the server sends before the learner's progress is read: every path as a plain link.
 * The screen needs the URL and local progress, so without this the HTML a search engine or
 * a slow phone receives would be a single loading line.
 */
function PathIndex({ paths }: { paths: readonly PathSummary[] }) {
  return (
    <section aria-labelledby="path-index" className="flex max-w-5xl flex-col gap-2 md:pt-2">
      <h1 id="path-index" className="t-section">
        Learning paths
      </h1>
      <ul className={rowList()}>
        {paths.map((path) => (
          <li key={path.id} className={rowItem}>
            <Link href={`/paths/${path.id}`} className="group flex items-start gap-2 py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{path.name}</span>
                <span className="text-muted text-sm">{path.promise}</span>
              </span>
              <ArrowRight
                aria-hidden
                size={16}
                strokeWidth={2}
                className={cn(rowArrow, 'mt-0.5')}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LearnScreen(props: {
  paths: readonly PathSummary[];
  catalog: PlanCatalog;
  tree: CourseTree;
}) {
  // `?path=` is read on the client; the boundary keeps the rest of the page static.
  return (
    <Suspense fallback={<PathIndex paths={props.paths} />}>
      <Learn {...props} />
    </Suspense>
  );
}
