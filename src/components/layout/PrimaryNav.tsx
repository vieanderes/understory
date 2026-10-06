'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/cn';
import { isCurrent, LIBRARY, PLACES, type Place } from './nav';

const item =
  'rounded-control flex h-4 items-center gap-1 px-1 text-sm font-medium transition-colors duration-150 ease-out';

const utility =
  'hover:text-fg hover:bg-raised rounded-control inline-flex size-5 items-center justify-center transition-colors duration-150 ease-out';

function RailLink({ place, current }: { place: Place; current: boolean }) {
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
      {label}
    </Link>
  );
}

/**
 * Desktop: a quiet rail on the ground, beside the page. The four places at the top; the
 * library, settings and the theme at the foot, drawn smaller, so they read as utilities you
 * reach for, not places you choose between. Where you are is a lifted row, not a colour.
 */
export function Sidebar() {
  const pathname = usePathname();
  const onLibrary = isCurrent(pathname, LIBRARY.href);
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
          <RailLink key={place.href} place={place} current={isCurrent(pathname, place.href)} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <Link
          href={LIBRARY.href}
          title={LIBRARY.hint}
          aria-current={onLibrary ? 'page' : undefined}
          className={cn(
            item,
            'font-normal',
            onLibrary ? 'bg-raised text-fg' : 'text-muted hover:text-fg hover:bg-raised',
          )}
        >
          <LIBRARY.icon aria-hidden size={16} strokeWidth={2} />
          {LIBRARY.label}
        </Link>
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
