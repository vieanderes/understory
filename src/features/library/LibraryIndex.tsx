import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  Gauge,
  GraduationCap,
  Headphones,
  ChartColumn,
  NotebookPen,
  Newspaper,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

export interface Shelf {
  href: string;
  icon: LucideIcon;
  title: string;
  note: string;
  /** A figure for the shelf, such as "370 lessons". */
  count?: string;
}

/** A shelf of the library: one row, its name, one line and its size. */
function ShelfRow({ shelf }: { shelf: Shelf }) {
  const { href, icon: Icon, title, note, count } = shelf;
  return (
    <li className="rule-t">
      <Link
        href={href}
        className="hairline-row group flex min-h-7 items-center gap-2 py-1.5 transition-colors duration-150 ease-out"
      >
        <Icon aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="text-muted block text-sm">{note}</span>
        </span>
        {count ? <span className="t-figure text-muted shrink-0 text-sm">{count}</span> : null}
        <ArrowRight
          aria-hidden
          size={16}
          strokeWidth={2}
          className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
}

export const SHELF_ICONS = {
  paths: GraduationCap,
  course: BookOpen,
  tests: SquareTerminal,
  lectures: Headphones,
  labs: FlaskConical,
  map: ChartColumn,
  decisions: NotebookPen,
  level: Gauge,
  news: Newspaper,
} as const;

const HOW = [
  { place: 'Home', text: 'Your next step, what is due and today’s news.' },
  {
    place: 'Learn',
    text: 'Your path: short lessons in order, a timed test after most stages, a final exam.',
  },
  { place: 'Practice', text: 'Pick topics and minutes. What is fading comes back first.' },
  { place: 'News', text: 'A daily edition, and every earlier one.' },
];

/**
 * The library: everything Understory holds, for when you want to look around rather than be
 * led. It sits beside Settings, not among the places, because most days you will not need it.
 */
export function LibraryIndex({ shelves, paths }: { shelves: Shelf[]; paths: Shelf[] }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 md:pt-4">
        <h1 className="t-title" data-arrive="title">
          Library
        </h1>
        <p data-arrive="rise" className="text-muted prose-measure text-lg">
          Everything in Understory, to browse. Nothing is locked.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-x-4 gap-y-8 md:grid-cols-12">
        <section
          aria-labelledby="shelves-title"
          className="col-span-4 flex flex-col gap-1 md:col-span-7"
        >
          <h2 id="shelves-title" className="t-section pb-1">
            Browse
          </h2>
          <ul className="rule-b flex flex-col">
            {shelves.map((shelf) => (
              <ShelfRow key={shelf.href} shelf={shelf} />
            ))}
          </ul>
          <h2 id="paths-title" className="t-section pt-4 pb-1">
            Learning paths
          </h2>
          <ul aria-labelledby="paths-title" className="rule-b flex flex-col">
            {paths.map((shelf) => (
              <ShelfRow key={shelf.href} shelf={shelf} />
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="how-title"
          className="col-span-4 flex flex-col gap-2 md:col-span-4 md:col-start-9"
        >
          <h2 id="how-title" className="t-section">
            How Understory works
          </h2>
          <dl className="flex flex-col">
            {HOW.map(({ place, text }) => (
              <div key={place} className="rule-t flex flex-col gap-0.5 py-1.5">
                <dt className="font-medium">{place}</dt>
                <dd className="text-muted text-sm">{text}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted text-sm">
            Your progress stays on this device. Export it in{' '}
            <Link href="/settings" className="text-fg underline underline-offset-4">
              Settings
            </Link>{' '}
            to move it.
          </p>
        </section>
      </div>
    </div>
  );
}
