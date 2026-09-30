import {
  BookOpen,
  FlaskConical,
  Route,
  House,
  Layers,
  Newspaper,
  Repeat2,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';

export interface Place {
  href: string;
  label: string;
  icon: LucideIcon;
  /** What the place is for, in a few words, for the rail's title and screen readers. */
  hint: string;
  /** A shorter label for the phone tab bar, where five places share the width. */
  short?: string;
}

/**
 * The five places. Learning paths are what you work through; Review keeps it; Coding tests
 * rehearse the timed, AI-assisted assessment employers send first; the library is where you
 * look things up. The phone tab bar holds exactly these five.
 */
export const PLACES: readonly Place[] = [
  { href: '/', label: 'Home', icon: House, hint: 'Your next lesson' },
  { href: '/paths', label: 'Paths', icon: Route, hint: 'Learning paths: work through a goal' },
  { href: '/practise', label: 'Review', icon: Repeat2, hint: 'Keep what you learnt' },
  {
    href: '/practise/online-test',
    label: 'Coding tests',
    short: 'Tests',
    icon: SquareTerminal,
    hint: 'AI-assisted coding simulator: timed tests, scored like the real ones',
  },
  { href: '/learn', label: 'Library', icon: BookOpen, hint: 'Every lesson and lecture' },
];

/** Useful, but not where the work happens: one step further out. */
export const MORE: readonly Place[] = [
  { href: '/map', label: 'Concept map', icon: Layers, hint: 'What you know, concept by concept' },
  { href: '/signal', label: 'News', icon: Newspaper, hint: 'What changed this week' },
  { href: '/labs', label: 'Labs', icon: FlaskConical, hint: 'Mechanisms to step through' },
];

/** A learning path as the rail lists it: enough to link to it and draw its route. */
export interface NavPath {
  id: string;
  name: string;
  stages: { title: string; lessonIds: string[] }[];
}

export function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/learn') return pathname === '/learn' || pathname.startsWith('/lectures');
  // The simulator lives under /practise but is its own place.
  const simulator = '/practise/online-test';
  if (href === '/practise') {
    return (
      (pathname === href || pathname.startsWith(`${href}/`)) && !pathname.startsWith(simulator)
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
