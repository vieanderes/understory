'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { EditionSummary } from '@/lib/news';
import { formatWeekday } from './format';
import { useProgress } from '@/features/store/StoreProvider';

/**
 * Editions as rows: the day, its lead story, and whether it was opened. Unread is carried
 * by weight and an ink dot, as the mastery map carries state, never by a coloured badge.
 */
export function EditionList({ editions }: { editions: EditionSummary[] }) {
  // Until the log is read nothing is marked, so no row flashes bold and then settles.
  const { status, state } = useProgress();
  return (
    <ul className="flex flex-col">
      {editions.map((edition) => {
        const unread = status === 'ready' && !state.newsRead.has(edition.date);
        return (
          <li key={edition.date} className="rule-t first:border-t-0">
            <Link
              href={`/signal/${edition.date}`}
              className="group hover:bg-raised rounded-control -mx-1 flex min-h-6 items-baseline gap-2 px-1 py-1 transition-colors duration-150 ease-out"
            >
              <span className="t-label t-figure w-10 shrink-0 whitespace-nowrap">
                {formatWeekday(edition.date)}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm',
                  unread ? 'text-fg font-medium' : 'text-muted',
                )}
              >
                {edition.lead ?? 'No stories'}
              </span>
              <span
                aria-hidden
                className={cn('size-1 shrink-0 rounded-full', unread ? 'bg-fg' : 'bg-transparent')}
              />
              {unread ? <span className="sr-only">Not read yet</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
