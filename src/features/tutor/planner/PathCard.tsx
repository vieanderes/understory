'use client';

import { ArrowRight, Route } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { Draft, DraftFacts } from '@/core/planner';
import { cn } from '@/lib/cn';
import { paceLine, sizeLine } from './facts';

/*
 * A path Scout drafted, in the conversation. The newest one carries the two actions: look
 * at it closely, or save it. An earlier draft is a line of history.
 */

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function PathCard({
  draft,
  facts,
  today,
  current,
  saved,
  savedHref,
  saving,
  edited,
  dropped,
  onOpen,
  onSave,
  onFollow,
}: {
  draft: Draft;
  facts: DraftFacts;
  today: string;
  /** The draft the learner is working on, edits included. */
  current: boolean;
  /** Saved, and unchanged since. */
  saved: boolean;
  savedHref?: string;
  saving: boolean;
  /** Changed by hand since Scout drafted it. */
  edited: boolean;
  /** Lessons Scout named that are not in the course. */
  dropped: number;
  onOpen: () => void;
  onSave: () => void;
  onFollow: () => void;
}) {
  if (!current) {
    return (
      <p className="text-muted flex items-center gap-1 py-0.5 text-sm">
        <Route aria-hidden size={16} strokeWidth={2} className="text-faint shrink-0" />
        <span className="min-w-0 truncate">{draft.name}</span>
        <span className="t-label shrink-0">Earlier draft</span>
      </p>
    );
  }
  const pace = paceLine(draft, facts, today);
  const gaps = facts.gaps.length;
  return (
    <article
      aria-label={`Draft path: ${draft.name}`}
      className="border-border bg-surface rounded-panel stream-in my-0.5 flex flex-col gap-1.5 border p-1.5"
    >
      <div className="flex flex-col gap-0.5">
        <p className="t-label">{edited ? 'Draft, edited' : 'Draft'}</p>
        <h3 className="text-lg font-semibold tracking-tight text-balance">{draft.name}</h3>
        {draft.summary ? <p className="text-muted text-sm text-pretty">{draft.summary}</p> : null}
      </div>
      <ol aria-label="Stages" className="flex flex-col">
        {draft.stages.map((stage, index) => (
          <li key={`${index}-${stage.title}`} className="flex items-baseline gap-1 text-sm">
            <span className="t-figure text-faint w-2 shrink-0">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate">{stage.title}</span>
            <span className="t-figure text-muted shrink-0">{stage.lessonIds.length}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-0.5">
        <p className="t-figure text-sm">{sizeLine(draft, facts)}</p>
        {pace ? <p className="text-muted text-sm text-pretty">{pace}</p> : null}
        {gaps > 0 ? (
          <p className="text-accent text-sm">
            {gaps === 1
              ? '1 lesson it builds on is missing'
              : `${gaps} lessons it builds on are missing`}
          </p>
        ) : null}
        {dropped > 0 ? (
          <p className="text-faint text-sm">
            Left out {dropped === 1 ? '1 lesson' : `${dropped} lessons`} the course does not have.
          </p>
        ) : null}
      </div>
      {saved && savedHref ? (
        <Link
          href={savedHref}
          onClick={onFollow}
          className={cn(
            'text-fg inline-flex min-h-5 w-fit items-center gap-0.5 text-sm font-medium underline-offset-4 hover:underline',
            FOCUS,
          )}
        >
          Saved. Open on Learn
          <ArrowRight aria-hidden size={16} strokeWidth={2} />
        </Link>
      ) : (
        <div className="flex flex-wrap gap-1">
          <Button variant="primary" size="md" loading={saving} onClick={onSave}>
            {savedHref ? 'Save changes' : 'Save path'}
          </Button>
          <Button variant="secondary" size="md" onClick={onOpen}>
            Open draft
          </Button>
        </div>
      )}
    </article>
  );
}
