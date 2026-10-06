'use client';

import { ArrowRight, Library, Repeat2 } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { newsTopicRank } from '@/core/profile';
import { useOverview } from '@/features/catalog/useOverview';
import { useProgress } from '@/features/store/StoreProvider';
import type { PathSummary } from '@/lib/content';
import { TodayCard } from '@/features/plan/PlanView';
import { usePlan } from '@/features/plan/usePlan';
import type { PlanCatalog } from '@/core/plan';
import { cn } from '@/lib/cn';
import { onPath } from './links';
import { CHOSEN_PATH, currentPath, nextOnPath } from './current';

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

/** The newest edition, trimmed to what Home shows: its date and its headlines. */
export interface NewsBrief {
  date: string;
  items: { id: string; title: string; topics: readonly string[] }[];
}

const editionDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

/**
 * Today's edition on Home: the lead and two more headlines, the learner's topics first, and
 * whether it has been read. A glance, with the whole edition one tap away.
 */
function NewsToday({ news, lead = false }: { news: NewsBrief; lead?: boolean }) {
  const { status, state } = useProgress();
  const interests = state.profile?.interests ?? [];
  const items = [...news.items].sort(
    (a, b) =>
      Math.min(...a.topics.map((t) => newsTopicRank(t, interests)), 1) -
      Math.min(...b.topics.map((t) => newsTopicRank(t, interests)), 1),
  );
  const shown = items.slice(0, lead ? 5 : 3);
  const read = status === 'ready' && state.newsRead.has(news.date);
  return (
    <section aria-labelledby="news-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h2 id="news-title" className="t-section">
          Today&apos;s news
        </h2>
        <p className="t-figure text-muted text-sm">
          {editionDate(news.date)}
          {status === 'ready' ? (read ? ' · read' : ' · new') : ''}
        </p>
      </div>
      <ol className="flex flex-col">
        {shown.map((item, i) => (
          <li key={item.id} className="rule-t">
            <Link
              href={`/signal/${news.date}#story-${item.id}`}
              className="group hover:bg-raised rounded-control -mx-1 flex min-h-6 items-baseline gap-2 px-1 py-1.5 transition-colors duration-150 ease-out"
            >
              <span
                className={cn(
                  'min-w-0 flex-1',
                  i === 0 ? 'text-lg font-semibold' : 'font-medium',
                  read && 'text-muted',
                )}
              >
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/signal"
        className="text-muted hover:text-fg inline-flex w-fit items-center gap-0.5 text-sm underline-offset-4 hover:underline"
      >
        Read the edition · {news.items.length} stories
        <ArrowRight aria-hidden size={16} strokeWidth={2} />
      </Link>
    </section>
  );
}

/** One line for practice: what is due, and the week so far. Hidden until there is something. */
function PracticeLine() {
  const { view } = useOverview();
  if (!view) return null;
  const due = view.due.dueNow;
  const started = view.started;
  if (!started && due === 0) return null;
  return (
    <section aria-label="Practice" className="rule-t rule-b">
      <Link
        href="/practise"
        className="group hover:bg-raised rounded-control -mx-1 flex min-h-7 items-center gap-2 px-1 py-1.5 transition-colors duration-150 ease-out"
      >
        <Repeat2 aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{due > 0 ? `${due} to review` : 'Practice'}</span>
          <span className="text-muted block text-sm">
            {due > 0 ? 'About 10 minutes, the fading ones first' : 'Pick a topic, 5 to 20 minutes'}
          </span>
        </span>
        <ArrowRight
          aria-hidden
          size={16}
          strokeWidth={2}
          className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
        />
      </Link>
    </section>
  );
}

function LibraryLink() {
  return (
    <Link
      href="/library"
      className="text-muted hover:text-fg inline-flex w-fit items-center gap-1 text-sm underline-offset-4 hover:underline"
    >
      <Library aria-hidden size={16} strokeWidth={2} />
      Every path, lesson, lecture and test is in the Library
    </Link>
  );
}

/**
 * Home answers one question: what do I do today? A first visit gets one promise and one
 * button, the setup. After that it is three things in a fixed order, each there only when it
 * has something to say: the next step, practice, today's news.
 */
export function HomeScreen({
  paths,
  course,
  catalog,
  news,
}: {
  paths: readonly PathSummary[];
  course: CourseOutline;
  catalog: PlanCatalog;
  news: NewsBrief | null;
}) {
  const planState = usePlan(catalog);
  const { status, state } = useProgress();
  const ready = status === 'ready';
  const isDone = (id: string) => ready && state.completedLessons.has(id);

  const anythingDone = ready && state.completedLessons.size > 0;
  const hasPlan = planState.plan !== undefined;
  const profile = ready ? state.profile : undefined;
  const newcomer = !anythingDone && !hasPlan && !profile;
  const newsOnly = !hasPlan && !anythingDone && profile !== undefined;
  const showNews = news !== null && (profile?.news ?? true);

  const beginner = paths.find((p) => p.id === 'start-coding');
  const firstStep = beginner?.stages[0]?.lessons[0];

  if (newcomer) {
    return (
      <div className="flex flex-col gap-10">
        <section
          aria-labelledby="home-title"
          className="flex max-w-4xl flex-col gap-3 pt-2 md:pt-4"
        >
          <h1 id="home-title" className="t-title" data-arrive="title">
            Learn to build software, one small step at a time.
          </h1>
          <p data-arrive="rise" className="text-muted prose-measure text-lg">
            Answer five quick questions and Understory plans your lessons, practice and daily news.
          </p>
          <div data-arrive="rise" className="flex flex-wrap items-center gap-1 pt-1">
            <Link href="/plan" className={buttonClass('primary')}>
              Set up · 1 minute
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
            {beginner && firstStep?.href ? (
              <Link href={onPath(firstStep.href, beginner.id)} className={buttonClass('quiet')}>
                Just start coding
              </Link>
            ) : null}
          </div>
        </section>
        {news ? <NewsToday news={news} /> : null}
        <LibraryLink />
      </div>
    );
  }

  if (newsOnly) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="sr-only">Home</h1>
        {news ? <NewsToday news={news} lead /> : null}
        <Link
          href="/plan?edit"
          className="text-muted hover:text-fg inline-flex w-fit items-center gap-0.5 text-sm underline-offset-4 hover:underline"
        >
          Want to learn as well? Set a goal
          <ArrowRight aria-hidden size={16} strokeWidth={2} />
        </Link>
        <LibraryLink />
      </div>
    );
  }

  // Without a plan, the next step is the next lesson of the path under way, else the
  // course's next lesson.
  const path = currentPath(paths, planState, isDone, state.settings[CHOSEN_PATH]);
  let next: { title: string; href: string; minutes: number; where: string } | undefined = path
    ? nextOnPath(path, isDone)
    : undefined;
  if (!next && anythingDone) {
    const lesson = course.order.find((l) => !isDone(l.id));
    if (lesson)
      next = {
        title: lesson.title,
        href: lesson.href,
        minutes: lesson.minutes,
        where: lesson.part,
      };
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="home-title" className="flex flex-col gap-2 pt-2 md:pt-4">
        <h1 id="home-title" className="t-section">
          Your next step
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
            Every path you started is done.{' '}
            <Link href="/plan?edit" className="text-fg underline underline-offset-4">
              Set a new goal
            </Link>
            .
          </p>
        )}
      </section>
      <PracticeLine />
      {showNews ? <NewsToday news={news} /> : null}
      <LibraryLink />
    </div>
  );
}
