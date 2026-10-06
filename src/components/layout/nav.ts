import { GraduationCap, House, Library, Newspaper, Repeat2, type LucideIcon } from 'lucide-react';

export interface Place {
  href: string;
  label: string;
  icon: LucideIcon;
  /** What the place is for, in a few words, for the rail's title and screen readers. */
  hint: string;
}

/**
 * The four places, one job each: Home says what to do today, Learn is your path, Practice
 * keeps it and rehearses tests, News is the daily edition. Everything else is the library,
 * a utility beside Settings: always there, never a decision you have to make.
 */
export const PLACES: readonly Place[] = [
  { href: '/', label: 'Home', icon: House, hint: 'What to do today' },
  { href: '/paths', label: 'Learn', icon: GraduationCap, hint: 'Your path, step by step' },
  { href: '/practise', label: 'Practice', icon: Repeat2, hint: 'Practise topics and sit tests' },
  {
    href: '/signal',
    label: 'News',
    icon: Newspaper,
    hint: "Today's edition and every earlier one",
  },
];

export const LIBRARY: Place = {
  href: '/library',
  label: 'Library',
  icon: Library,
  hint: 'Every path, lesson, lecture, lab and test',
};

/** Pages the library holds. They light up the library, not a place. */
const LIBRARY_ROUTES = ['/library', '/lectures', '/labs', '/map', '/decisions'];

export function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === LIBRARY.href) {
    return (
      pathname === '/learn' ||
      LIBRARY_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
