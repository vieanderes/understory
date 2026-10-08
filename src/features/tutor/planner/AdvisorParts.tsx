'use client';

import { ChevronRight, Flag } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DraftCut, Milestone } from '@/core/planner';
import { cn } from '@/lib/cn';

/*
 * The Advisor's parts of a path (docs/SCOUT-ROLES.md, section 4), shown alike in Scout's
 * draft and on the path page: where it ends, what each stage makes, and what was left out.
 */

export function Destination({
  destination,
  baseline,
}: {
  destination?: string;
  baseline?: string;
}) {
  if (!destination && !baseline) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {destination ? (
        <>
          <p className="t-label">Destination</p>
          <p className="text-base text-pretty">{destination}</p>
        </>
      ) : null}
      {baseline ? (
        <p className="text-muted text-sm text-pretty">Starting from: {baseline}</p>
      ) : null}
    </div>
  );
}

export function MilestoneLine({
  milestone,
  met,
  action,
}: {
  milestone: Milestone;
  met?: boolean;
  /** A control beside it, such as marking it met. */
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-1">
      <Flag
        aria-hidden
        size={16}
        strokeWidth={2}
        className={cn('mt-0.5 shrink-0', met ? 'text-success' : 'text-faint')}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm text-pretty">
          <span className="sr-only">Milestone{met ? ', met' : ''}: </span>
          {milestone.output}
        </p>
        <p className="text-faint text-sm text-pretty">{milestone.check}</p>
      </div>
      {action}
    </div>
  );
}

export function CutList({
  cut,
  onRestore,
}: {
  cut: readonly DraftCut[];
  /** Brings an item with lessons back into the path. */
  onRestore?: (index: number) => void;
}) {
  if (cut.length === 0) return null;
  return (
    <details className="group rule-t">
      <summary className="t-label flex min-h-5 cursor-pointer items-center gap-1">
        <ChevronRight
          aria-hidden
          size={16}
          strokeWidth={2}
          className="transition-transform duration-150 ease-out group-open:rotate-90"
        />
        Left out for now · {cut.length}
      </summary>
      <ul className="flex flex-col gap-1 pb-1">
        {cut.map((item, i) => (
          <li key={item.what} className="flex items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-sm font-medium">{item.what}</p>
              <p className="text-muted text-sm text-pretty">
                {item.later ? '' : 'Not needed for this destination. '}
                {item.why}
              </p>
            </div>
            {onRestore && item.lessonIds.length > 0 ? (
              <button
                type="button"
                onClick={() => onRestore(i)}
                className={cn(
                  'text-muted hover:text-fg min-h-5 shrink-0 px-1 text-sm underline-offset-4 hover:underline',
                  'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
                )}
              >
                Bring back
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
