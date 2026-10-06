'use client';

import { Newspaper, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { pathExamResult } from '@/core/exam';
import { useProgress } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { isCurrent, MORE, PLACES, type NavPath } from './nav';

const item =
  'rounded-control flex h-4 items-center gap-1 px-1 text-sm font-medium transition-colors duration-150 ease-out';

/**
 * Desktop: a quiet rail on the ground, beside the page. Three layers, each drawn its own
 * way so they never read as one list: the four places (icon rows), your learning paths (each
 * with its route and what is done, set in from the edge), and the rest (small text links at
 * the foot, beside settings and the theme). Where you are is a lifted row, not a colour.
 */
export function Sidebar({ paths }: { paths: readonly NavPath[] }) {
  const pathname = usePathname();
  const { status, state } = useProgress();
  const isDone = (id: string) => status === 'ready' && state.completedLessons.has(id);
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
        {PLACES.map(({ href, label, icon: Icon, hint }) => {
          const current = isCurrent(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={hint}
              aria-current={current ? 'page' : undefined}
              className={cn(
                item,
                current
                  ? 'bg-raised text-fg shadow-edge'
                  : 'text-muted hover:text-fg hover:bg-raised',
              )}
            >
              <Icon aria-hidden size={16} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
      {paths.length > 0 ? (
        <nav
          aria-labelledby="rail-paths"
          className="rule-t flex min-h-0 flex-col gap-0.5 overflow-y-auto pt-2"
        >
          <p id="rail-paths" className="text-faint px-1 pb-0.5 text-sm font-medium tracking-tight">
            Learning paths
          </p>
          {paths.map((path) => {
            const href = `/paths/${path.id}`;
            const current = pathname === href || pathname.startsWith(`${href}/`);
            const ids = path.stages.flatMap((s) => s.lessonIds);
            const done = ids.filter(isDone).length;
            const finished = ids.length > 0 && done === ids.length;
            const certified = status === 'ready' && pathExamResult(state.pathExams[path.id]).passed;
            return (
              <Link
                key={path.id}
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  item,
                  current
                    ? 'bg-raised text-fg shadow-edge'
                    : 'text-muted hover:text-fg hover:bg-raised',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{path.name}</span>
                <span className="t-figure text-faint shrink-0">
                  {certified ? 'Certified' : finished ? 'Done' : `${done}/${ids.length}`}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}
      <div className="mt-auto flex flex-col gap-1">
        <nav aria-label="More" className="flex flex-col gap-0.5">
          {MORE.map(({ href, label, icon: Icon, hint }) => {
            const current = isCurrent(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={hint}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  item,
                  'font-normal',
                  current ? 'bg-raised text-fg' : 'text-faint hover:text-fg hover:bg-raised',
                )}
              >
                <Icon aria-hidden size={16} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="rule-t flex items-center gap-0.5 pt-1">
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 items-center justify-center transition-colors duration-150 ease-out"
          >
            <Settings aria-hidden size={20} strokeWidth={2} />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

const utility =
  'hover:text-fg hover:bg-raised rounded-control inline-flex size-5 items-center justify-center transition-colors duration-150 ease-out';

/**
 * Phone: a slim bar with the mark and the utilities. News sits here rather than in the tab
 * bar: a sixth tab would crowd the five places, and a daily edition is something you check,
 * like an inbox, not a place you work in. Concept map and Labs are reached from Home.
 */
export function PhoneBar() {
  const pathname = usePathname();
  const onNews = isCurrent(pathname, '/signal');
  return (
    <header className="rule-b bg-bg sticky top-0 z-20 md:hidden print:hidden">
      <div className="frame flex h-7 items-center justify-between gap-2">
        <Link href="/" aria-label="Understory, home" className="rounded-control">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-0.5">
          <Link
            href="/signal"
            aria-label="News"
            title="News"
            aria-current={onNews ? 'page' : undefined}
            className={cn(utility, onNews ? 'bg-raised text-fg shadow-edge' : 'text-muted')}
          >
            <Newspaper aria-hidden size={20} strokeWidth={2} />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
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
 * Phone: five places in the thumb zone, clear of the home indicator. Where you are is a
 * pill behind the icon, filled with the hairline tone so it reads in both themes, not a
 * rule on the edge: the bar stays quiet and the place reads at a glance.
 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="rule-t bg-bg pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 md:hidden print:hidden"
    >
      {PLACES.map(({ href, label, short, icon: Icon }) => {
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
            <span aria-hidden={short ? true : undefined}>{short ?? label}</span>
            {short ? <span className="sr-only">{label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
