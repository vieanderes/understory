'use client';

import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  Headphones,
  Layers,
  Repeat2,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { percent, scoreTallies } from '@/core/online-test/score';
import { useOverview } from '@/features/catalog/useOverview';
import { useProgress } from '@/features/store/StoreProvider';
import type { PathSummary } from '@/lib/content';
import { onPath } from './links';
import { PathRow } from './PathsIndex';
import { GoalShortcuts } from '@/features/plan/GoalShortcuts';
import { TodayCard } from '@/features/plan/PlanView';
import { usePlan } from '@/features/plan/usePlan';
import type { PlanCatalog } from '@/core/plan';

export interface CourseLesson {
  id: string;
  title: string;
  href: string;
  minutes: number;
  part: string;
}

export interface CourseOutline {
  lessons: number;
  parts: number;
  /** Every lesson in course order, for "continue where you left off" outside a path. */
  order: CourseLesson[];
}

const MORE_WAYS: { href: string; icon: LucideIcon; title: string; note: string }[] = [
  { href: '/learn', icon: BookOpen, title: 'Library', note: 'Every lesson, in seven parts' },
  {
    href: '/practise/online-test',
    icon: SquareTerminal,
    title: 'Coding tests',
    note: 'Timed, AI-assisted tests, scored like the real ones',
  },
  {
    href: '/lectures',
    icon: Headphones,
    title: 'Lectures',
    note: 'The course to read or listen to',
  },
  { href: '/labs', icon: FlaskConical, title: 'Labs', note: 'Mechanisms to step through' },
  { href: '/map', icon: Layers, title: 'Concept map', note: 'What you know, concept by concept' },
  { href: '/practise', icon: Repeat2, title: 'Review', note: 'Keep what you learnt' },
];

function MoreWays() {
  return (
    <section aria-labelledby="more-title" className="flex flex-col gap-2">
      <h2 id="more-title" className="t-section">
        More ways to learn
      </h2>
      <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
        {MORE_WAYS.map(({ href, icon: Icon, title, note }) => (
          <li key={href} className="rule-t">
            <Link
              href={href}
              className="group hover:bg-raised rounded-control -mx-1 flex min-h-6 items-center gap-2 px-1 py-2 transition-colors duration-150 ease-out"
            >
              <Icon aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{title}</span>
                <span className="text-muted block text-sm">{note}</span>
              </span>
              <ArrowRight
                aria-hidden
                size={16}
                strokeWidth={2}
                className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Home answers one question for the whole course: where am I, and what is my next step?
 *
 * Before anything is done it introduces the course and offers the beginning, with the paths
 * beside it as equal choices, so no one path speaks for the app. Once work is under way it
 * leads with where the learner actually is: the path with the most done that is not
 * finished, or the next lesson in course order when they have been working outside a path.
 */
export function HomeScreen({
  paths,
  course,
  catalog,
}: {
  paths: readonly PathSummary[];
  course: CourseOutline;
  catalog: PlanCatalog;
}) {
  const planState = usePlan(catalog);
  const { status, state } = useProgress();
  const { view } = useOverview();
  const ready = status === 'ready';
  const isDone = (id: string) => ready && state.completedLessons.has(id);

  const scored = paths.map((path) => {
    const done = path.lessonIds.filter(isDone).length;
    return { path, done, finished: done === path.lessonIds.length };
  });
  const started = scored.filter((s) => s.done > 0);
  const active = [...started].filter((s) => !s.finished).sort((a, b) => b.done - a.done)[0];
  const anythingDone = ready && state.completedLessons.size > 0;
  const hasPlan = planState.plan !== undefined;
  const newcomer = !anythingDone && !hasPlan;

  // Where to continue: the active path's next lesson, else the course's next lesson.
  let next: { title: string; href: string; minutes: number; where: string } | undefined;
  if (active) {
    const lesson = active.path.stages.flatMap((s) => s.lessons).find((l) => !isDone(l.id));
    if (lesson?.href) {
      const position = active.path.lessonIds.indexOf(lesson.id) + 1;
      next = {
        title: lesson.title,
        href: onPath(lesson.href, active.path.id),
        minutes: lesson.minutes,
        where: `${active.path.name} · lesson ${position} of ${active.path.lessonIds.length}`,
      };
    }
  } else if (anythingDone) {
    const lesson = course.order.find((l) => !isDone(l.id));
    if (lesson)
      next = {
        title: lesson.title,
        href: lesson.href,
        minutes: lesson.minutes,
        where: lesson.part,
      };
  }

  const beginner = paths.find((p) => p.id === 'start-coding');
  const firstStep = beginner?.stages[0]?.lessons[0];
  const lastTest = state.onlineTests.at(-1);
  const due = view?.due.dueNow ?? 0;

  if (newcomer) {
    return (
      <div className="flex flex-col gap-10">
        <section
          aria-labelledby="home-title"
          className="flex max-w-4xl flex-col gap-3 pt-2 md:pt-4"
        >
          <p className="t-label">Understory</p>
          <h1 id="home-title" className="t-title" data-arrive="title">
            Learn to build software, one small step at a time.
          </h1>
          <p data-arrive="rise" className="text-muted prose-measure text-lg">
            {course.lessons} short lessons in {course.parts} parts, from your first line of code to
            a system in production. Each one is something you write and run.
          </p>
          <div data-arrive="rise" className="flex flex-wrap items-center gap-1 pt-1">
            <Link href="/plan" className={buttonClass('primary')}>
              Make my plan · 30 seconds
            </Link>
            {beginner && firstStep?.href ? (
              <Link href={onPath(firstStep.href, beginner.id)} className={buttonClass('quiet')}>
                Just start coding
              </Link>
            ) : null}
          </div>
        </section>

        <GoalShortcuts />

        <section aria-labelledby="goals-title" className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 id="goals-title" className="t-section">
              All learning paths
            </h2>
            <p className="text-muted">
              Each path picks the lessons for one goal and ends in an exam. Nothing is locked.
            </p>
          </div>
          <ol className="border-border rounded-panel divide-border divide-y overflow-hidden border">
            {scored.map(({ path }) => (
              <PathRow key={path.id} path={path} compact />
            ))}
          </ol>
        </section>

        <MoreWays />
      </div>
    );
  }

  const others = scored.filter((s) => s.done === 0);
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="home-title" className="flex flex-col gap-3 pt-2 md:pt-4">
        <p className="t-label">Welcome back</p>
        <h1 id="home-title" className="t-section">
          {hasPlan ? 'Your next step' : 'Pick up where you left off'}
        </h1>
        {hasPlan ? (
          <TodayCard state={planState} />
        ) : next ? (
          <div
            data-arrive="rise"
            className="bg-surface border-border rounded-panel flex flex-col gap-3 border p-3 md:flex-row md:items-center md:justify-between md:p-4"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="t-label">{next.where}</p>
              <p className="text-lg font-semibold">
                <InlineCode text={next.title} />
              </p>
            </div>
            <Link href={next.href} className={buttonClass('primary', 'lg', 'shrink-0')}>
              Continue · {next.minutes} min
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          </div>
        ) : (
          <p className="text-muted">
            Every path you started is done. Choose another below, or keep it fresh in Review.
          </p>
        )}
      </section>

      {hasPlan ? null : (
        <Link
          href="/plan"
          className="group border-border hover:bg-raised rounded-panel flex items-center gap-2 border p-2 transition-colors duration-150 ease-out"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Make a plan for your goal</span>
            <span className="text-muted block text-sm">
              Two questions, then phases, milestones and a step for each day.
            </span>
          </span>
          <ArrowRight
            aria-hidden
            size={16}
            strokeWidth={2}
            className="text-faint group-hover:text-fg shrink-0"
          />
        </Link>
      )}

      <div className="rule-t rule-b grid grid-cols-1 sm:grid-cols-3">
        <Link
          href="/practise"
          className="group hover:bg-raised flex flex-col gap-0.5 px-1 py-2 transition-colors duration-150 ease-out sm:pr-3"
        >
          <span className="font-semibold">Review</span>
          <span className="text-muted text-sm">
            {!view
              ? 'reading your progress'
              : due > 0
                ? `${due} due now, about 10 minutes`
                : 'nothing due, memory is holding'}
          </span>
        </Link>
        <div className="border-border flex flex-col gap-1 px-1 py-2 sm:border-l sm:px-3">
          <span className="font-semibold">This week</span>
          <span className="flex items-center gap-2">
            <span className="t-figure text-muted shrink-0 text-sm">
              {view ? `${Math.round(view.week.xpThisWeek)} / ${view.week.goal} XP` : '··'}
            </span>
            <ProgressLine
              className="max-w-30"
              value={view ? Math.min(1, view.week.xpThisWeek / view.week.goal) : 0}
              label="Weekly goal"
            />
          </span>
        </div>
        <Link
          href="/practise/online-test"
          className="group hover:bg-raised border-border flex flex-col gap-0.5 px-1 py-2 transition-colors duration-150 ease-out sm:border-l sm:pl-3"
        >
          <span className="font-semibold">Coding tests</span>
          <span className="text-muted t-figure text-sm">
            {lastTest
              ? `Last: ${lastTest.title}, ${percent(scoreTallies(lastTest.tasks))}%`
              : 'Sit a timed test when you are ready'}
          </span>
        </Link>
      </div>

      {started.length > 0 ? (
        <section aria-labelledby="paths-title" className="flex flex-col gap-2">
          <h2 id="paths-title" className="t-section">
            Your paths
          </h2>
          <ol className="border-border rounded-panel divide-border divide-y overflow-hidden border">
            {started.map(({ path }) => (
              <PathRow key={path.id} path={path} compact />
            ))}
          </ol>
        </section>
      ) : null}

      {others.length > 0 ? (
        <section aria-labelledby="other-paths-title" className="flex flex-col gap-2">
          <h2 id="other-paths-title" className="t-section">
            {started.length > 0
              ? 'Other paths'
              : hasPlan
                ? 'All learning paths'
                : 'Work towards a goal'}
          </h2>
          <ol className="border-border rounded-panel divide-border divide-y overflow-hidden border">
            {others.map(({ path }) => (
              <PathRow key={path.id} path={path} compact />
            ))}
          </ol>
        </section>
      ) : null}

      <MoreWays />
    </div>
  );
}
