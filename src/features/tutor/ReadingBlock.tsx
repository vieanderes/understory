'use client';

import { ArrowUpRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { parseReadingBlock, type LibraryEntry } from '@/core/scout';
import { cn } from '@/lib/cn';

/*
 * The Librarian's picks (docs/SCOUT-ROLES.md, section 5). Each id is looked up in the
 * course's library: one Scout made up is dropped, so only a reference the course carries
 * reaches the learner, with what the course says about it.
 */

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function ReadingBlock({
  body,
  library,
}: {
  body: string;
  library: ReadonlyMap<string, LibraryEntry>;
}) {
  const block = parseReadingBlock(body);
  const items = (block?.items ?? []).flatMap(({ id, why }) => {
    const entry = library.get(id);
    return entry ? [{ entry, why }] : [];
  });
  if (items.length === 0) return null;
  return (
    <ol aria-label="Worth reading" className="rule-t flex flex-col py-0.5">
      {items.map(({ entry, why }, index) => {
        const byline = [entry.kind, entry.authors, entry.year].filter(Boolean).join(' · ');
        return (
          <li
            key={entry.id}
            className="stream-in rule-b flex flex-col gap-0.5 py-1"
            style={{ '--i': index } as CSSProperties}
          >
            {entry.url ? (
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'inline-flex items-start gap-0.5 text-sm font-medium text-pretty underline-offset-4 hover:underline',
                  FOCUS,
                )}
              >
                {entry.title}
                <ArrowUpRight aria-hidden size={16} strokeWidth={2} className="shrink-0" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <p className="text-sm font-medium text-pretty">{entry.title}</p>
            )}
            <p className="t-figure text-faint text-sm">{byline}</p>
            <p className="text-sm text-pretty">{why}</p>
            {entry.verified ? null : (
              <p className="text-muted text-sm">Not yet checked by a person.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
