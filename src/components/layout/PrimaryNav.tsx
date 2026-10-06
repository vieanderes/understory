'use client';

import { ChartColumn, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { useOverview } from '@/features/catalog/useOverview';
import { chosenPathIds, CHOSEN_PATH } from '@/features/paths/current';
import { useProgress } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { isCurrent, LIBRARY, PLACES, type Place } from './nav';

const item =
  'rounded-control flex h-4 items-center gap-1 px-1 text-sm font-medium transition-colors duration-150 ease-out';

const utility =
  'hover:text-fg hover:bg-raised rounded-control inline-flex size-5 items-center justify-center transition-colors duration-150 ease-out';

function RailLink({
  place,
  current,
  count,
}: {
  place: Place;
  current: boolean;
  /** A figure beside the label, such as the items due on Practice. */
  count?: number;
}) {
  const { href, label, icon: Icon, hint } = place;
  return (
    <Link
      href={href}
      title={hint}
      aria-current={current ? 'page' : undefined}
      className={cn(
        item,
        current ? 'bg-raised text-fg shadow-edge' : 'text-muted hover:text-fg hover:bg-raised',
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={2} />
      <span className="flex-1">{label}</span>
      {count ? (
        <span className="t-figure text-muted text-sm">
          {count}
          <span className="sr-only"> due</span>
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Desktop: a quiet rail on the ground, beside the page. The four places at the top; the
 * library, settings and the theme at the foot, drawn smaller, so they read as utilities you
 * reach for, not places you choose between. Where you are is a lifted row, not a colour.
 */
/** A path as the rail knows it: enough to link to it and count what is done. */
export interface RailPath {
  id: string;
  name: string;
  lessonIds: readonly string[];
}

/**
 * The paths the learner chose, each with what is done: the way back into a path from any
 * page. Without a choice yet, one quiet link to make it.
 */
function YourPaths({ paths }: { paths: readonly RailPath[] }) {
  const { status, state } = useProgress();
  if (status !== 'ready') return null;
  const all: RailPath[] = [
    ...[...state.ownPaths.values()].map(({ id, name, lessonIds }) => ({ id, name, lessonIds })),
    ...paths,
  ];
  const chosen = chosenPathIds(state.settings[CHOSEN_PATH]).flatMap(
    (id) => all.find((p) => p.id === id) ?? [],
  );
  return (
    <nav aria-labelledby="rail-paths" className="flex flex-col gap-0.5">
      <p id="rail-paths" className="t-label px-1 pb-0.5">
        Your paths
      </p>
      {chosen.length === 0 ? (
        <Link
          href="/paths"
          className={cn(item, 'text-muted hover:text-fg hover:bg-raised font-normal')}
        >
          Choose your path
        </Link>
      ) : (
        chosen.map((path) => {
          const done = path.lessonIds.filter((id) => state.completedLessons.has(id)).length;
          return (
            <Link
              key={path.id}
              href={`/paths?path=${path.id}`}
              className={cn(item, 'text-muted hover:text-fg hover:bg-raised font-normal')}
            >
              <span className="min-w-0 flex-1 truncate">{path.name}</span>
              <span className="t-figure text-faint text-sm">
                {done}/{path.lessonIds.length}
              </span>
            </Link>
          );
        })
      )}
    </nav>
  );
}

/** This week's XP against the goal: a glance at the pace, one tap from the whole picture. */
function WeekMeter() {
  const { view } = useOverview();
  if (!view) return null;
  const { xpThisWeek, goal, met } = view.week;
  return (
    <Link
      href="/progress"
      title="Your progress"
      className="rounded-control hover:bg-raised flex flex-col gap-1 px-1 py-1 transition-colors duration-150 ease-out"
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="t-label">This week</span>
        <span className="t-figure text-sm">
          {xpThisWeek}
          <span className="text-muted"> / {goal} XP</span>
        </span>
      </span>
      <ProgressLine
        value={Math.min(1, xpThisWeek / Math.max(1, goal))}
        label={met ? 'Weekly goal met' : `${xpThisWeek} of ${goal} XP this week`}
      />
    </Link>
  );
}

/**
 * Desktop: a quiet rail on the ground, beside the page. The four places at the top, the
 * paths the learner chose under them, and at the foot this week's pace, the library and
 * progress, settings and the theme, drawn smaller: utilities you reach for, not places.
 */
export function Sidebar({ paths = [] }: { paths?: readonly RailPath[] }) {
  const pathname = usePathname();
  const { view } = useOverview();
  const due = view?.due.dueNow ?? 0;
  const onLibrary = isCurrent(pathname, LIBRARY.href) && !pathname.startsWith('/progress');
  const onProgress = pathname.startsWith('/progress');
  const utilityRow = (current: boolean) =>
    cn(
      item,
      'font-normal',
      current ? 'bg-raised text-fg' : 'text-muted hover:text-fg hover:bg-raised',
    );
  return (
    <aside className="sticky top-0 hidden h-dvh w-30 shrink-0 flex-col gap-4 px-1.5 py-2 md:flex print:hidden">
      <Link
        href="/"
        aria-label="Understory, home"
        className="rounded-control flex h-5 items-center px-1"
      >
        <Wordmark />
      </Link>
      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {PLACES.map((place) => (
          <RailLink
            key={place.href}
            place={place}
            current={isCurrent(pathname, place.href)}
            {...(place.href === '/practise' && due > 0 ? { count: due } : {})}
          />
        ))}
      </nav>
      <div className="rule-t min-h-0 overflow-y-auto pt-2">
        <YourPaths paths={paths} />
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <WeekMeter />
        <div className="flex flex-col gap-0.5">
          <Link
            href="/progress"
            aria-current={onProgress ? 'page' : undefined}
            className={utilityRow(onProgress)}
          >
            <ChartColumn aria-hidden size={16} strokeWidth={2} />
            Progress
          </Link>
          <Link
            href={LIBRARY.href}
            title={LIBRARY.hint}
            aria-current={onLibrary ? 'page' : undefined}
            className={utilityRow(onLibrary)}
          >
            <LIBRARY.icon aria-hidden size={16} strokeWidth={2} />
            {LIBRARY.label}
          </Link>
        </div>
        <div className="rule-t flex items-center gap-0.5 pt-1">
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            aria-current={isCurrent(pathname, '/settings') ? 'page' : undefined}
            className={cn(utility, 'text-muted')}
          >
            <Settings aria-hidden size={20} strokeWidth={2} />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/**
 * Phone: a slim bar with the mark and the utilities: the library, named, so it is found
 * without guessing at an icon; then settings and the theme.
 */
export function PhoneBar() {
  const pathname = usePathname();
  const onLibrary = isCurrent(pathname, LIBRARY.href);
  return (
    <header className="rule-b bg-bg sticky top-0 z-20 md:hidden print:hidden">
      <div className="frame flex h-7 items-center justify-between gap-2">
        <Link href="/" aria-label="Understory, home" className="rounded-control">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-0.5">
          <Link
            href={LIBRARY.href}
            title={LIBRARY.hint}
            aria-current={onLibrary ? 'page' : undefined}
            className={cn(
              'rounded-control inline-flex h-5 items-center gap-0.5 px-1 text-sm font-medium transition-colors duration-150 ease-out',
              onLibrary
                ? 'bg-raised text-fg shadow-edge'
                : 'text-muted hover:text-fg hover:bg-raised',
            )}
          >
            <LIBRARY.icon aria-hidden size={20} strokeWidth={2} />
            {LIBRARY.label}
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            aria-current={isCurrent(pathname, '/settings') ? 'page' : undefined}
            className={cn(utility, 'text-muted')}
          >
            <Settings aria-hidden size={20} strokeWidth={2} />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * Phone: the four places in the thumb zone, clear of the home indicator. Where you are is a
 * pill behind the icon, filled with the hairline tone so it reads in both themes.
 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="rule-t bg-bg pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 md:hidden print:hidden"
    >
      {PLACES.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'group flex h-8 flex-col items-center justify-center gap-0.5 text-sm',
              'focus-visible:outline-accent focus-visible:outline-2 focus-visible:-outline-offset-2',
              // State by weight as well as the pill (docs/DESIGN.md, law 9).
              current ? 'text-fg font-semibold' : 'text-faint font-normal',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'transition-press inline-flex h-4 w-7 items-center justify-center rounded-full',
                current ? 'bg-border text-fg' : 'group-active:bg-raised',
              )}
            >
              <Icon size={20} strokeWidth={2} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
