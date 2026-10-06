'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { EditionSummary } from '@/lib/news';
import { formatWeekday } from './format';
import { useProgress } from '@/features/store/StoreProvider';

/**
 * Editions as rows: the day and its lead story. One already read steps back into the muted
 * tone, so what is new reads first; there is no badge or dot to keep track of.
 */
export function EditionList({ editions }: { editions: EditionSummary[] }) {
  // Until the log is read nothing is marked, so no row flashes bold and then settles.
  const { status, state } = useProgress();
  return (
    <ul className="flex flex-col">
      {editions.map((edition) => {
        const read = status === 'ready' && state.newsRead.has(edition.date);
        return (
          <li key={edition.date} className="rule-t first:border-t-0">
            <Link
              href={`/signal/${edition.date}`}
              className="group hover:bg-raised rounded-control -mx-1 flex min-h-6 items-baseline gap-2 px-1 py-1 transition-colors duration-150 ease-out"
            >
              <span className="t-label t-figure w-10 shrink-0 whitespace-nowrap">
                {formatWeekday(edition.date)}
              </span>
              <span className={cn('min-w-0 flex-1 text-sm', read ? 'text-muted' : 'text-fg')}>
                {edition.lead ?? 'No stories'}
                {read ? <span className="sr-only">, read</span> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
