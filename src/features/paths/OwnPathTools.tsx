'use client';

import { Check, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { formatMinutes } from '@/core/insight';
import { pathPace } from '@/core/planner/pace';
import { useNow } from '@/features/catalog/useNow';
import type { OwnPath } from '@/core/progress';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { ScoutMark } from '@/features/tutor/ScoutMark';
import { planHref } from '@/features/tutor/planner/planner-store';
import { CHOSEN_PATH, chosenPathIds } from './current';

/*
 * What a learner can do with a path they made: change it in the builder, by hand or with
 * Scout, or remove it. Removing is a fact like saving, so Undo records
 * the path again rather than hiding a deletion.
 */

const QUIET = buttonClass('quiet', 'md', 'text-muted hover:text-fg');

function payload(path: OwnPath) {
  const { id, ...rest } = path;
  return { pathId: id, ...rest };
}

export function OwnPathTools({ pathId }: { pathId: string }) {
  const store = useStore();
  const { status, state } = useProgress();
  const path = status === 'ready' ? state.ownPaths.get(pathId) : undefined;
  if (!path) return null;

  const remove = async () => {
    const chosen = chosenPathIds(state.settings[CHOSEN_PATH]);
    await store.record('custom_path_set', {
      pathId: path.id,
      name: path.name,
      lessonIds: [],
      origin: path.origin,
    });
    await store.record('setting_changed', {
      key: CHOSEN_PATH,
      value: chosen.filter((id) => id !== path.id).join(','),
    });
    setRemoved({ path, chosen });
  };

  return (
    <>
      <Link href={planHref(path.id)} className={QUIET}>
        <ScoutMark size={16} />
        Plan again with Scout
      </Link>
      <Link href={`/learn/build?path=${path.id}`} className={QUIET}>
        <Pencil aria-hidden size={16} strokeWidth={2} />
        Edit lessons
      </Link>
      <button type="button" onClick={() => void remove()} className={QUIET}>
        <Trash2 aria-hidden size={16} strokeWidth={2} />
        Remove
      </button>
    </>
  );
}

/*
 * The undo outlives the path's own page, which goes as the path does, so it sits in a
 * module store that Learn shows.
 */
let lastRemoved: { path: OwnPath; chosen: string[] } | null = null;
const listeners = new Set<() => void>();

function setRemoved(next: typeof lastRemoved) {
  lastRemoved = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function RemovedPathNotice() {
  const store = useStore();
  const removed = useSyncExternalStore(
    subscribe,
    () => lastRemoved,
    () => null,
  );
  if (!removed) return null;
  const { path, chosen } = removed;
  const undo = async () => {
    await store.record('custom_path_set', payload(path));
    await store.record('setting_changed', { key: CHOSEN_PATH, value: chosen.join(',') });
    setRemoved(null);
  };
  return (
    <div
      role="status"
      className="rule-b text-muted flex min-h-5 items-center justify-between gap-1 pb-1 text-sm"
    >
      <span>Removed {path.name}.</span>
      <span className="flex items-center gap-0.5">
        <button type="button" onClick={() => void undo()} className={buttonClass('quiet', 'md')}>
          Undo
        </button>
        <button type="button" onClick={() => setRemoved(null)} className={QUIET}>
          Dismiss
        </button>
      </span>
    </div>
  );
}

/** How long an own path takes at the pace it was planned for, from what is left of it. */
export function OwnPathPace({ pathId, minutesLeft }: { pathId: string; minutesLeft: number }) {
  const { status, state } = useProgress();
  const now = useNow();
  const pace = status === 'ready' ? state.ownPaths.get(pathId)?.pace : undefined;
  if (!pace || !now || minutesLeft === 0) return null;
  const today = now.toLocaleDateString('en-CA');
  const { weeks, fits, minutesPerWeekNeeded } = pathPace(minutesLeft, pace, today);
  const perWeek = formatMinutes(pace.minutesPerWeek);
  const deadline = pace.deadline
    ? new Date(`${pace.deadline}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : undefined;
  return (
    <p className="text-muted text-sm" data-arrive="rise">
      About {weeks} {weeks === 1 ? 'week' : 'weeks'} at {perWeek} a week
      {deadline
        ? fits
          ? `, done before ${deadline}.`
          : `. To finish by ${deadline} it needs ${formatMinutes(minutesPerWeekNeeded ?? 0)} a week.`
        : '.'}
    </p>
  );
}

/**
 * Marks a milestone of an own path met, or takes the mark back. The learner's word, as a
 * capstone is: Scout never marks one.
 */
export function MilestoneMark({ pathId, milestone }: { pathId: string; milestone: string }) {
  const store = useStore();
  const { status, state } = useProgress();
  if (status !== 'ready') return null;
  const met = state.milestonesMet.get(pathId)?.has(milestone) ?? false;
  return (
    <Button
      variant="quiet"
      size="md"
      aria-pressed={met}
      onClick={() => void store.record('milestone_marked', { pathId, milestone, met: !met })}
      className="text-muted hover:text-fg -my-1 shrink-0"
    >
      {met ? <Check aria-hidden size={16} strokeWidth={2} className="text-success" /> : null}
      {met ? 'Met' : 'Mark met'}
    </Button>
  );
}
