'use client';

import { useEffect } from 'react';
import type { Interest } from '@/core/profile/interests';
import { useProgress, useStore } from '@/features/store/StoreProvider';

const NONE: ReadonlySet<string> = new Set();
const NO_INTERESTS: readonly Interest[] = [];

/** Dates of the editions the learner has opened. Empty until the log is read. */
export function useNewsRead(): ReadonlySet<string> {
  const { status, state } = useProgress();
  return status === 'ready' ? state.newsRead : NONE;
}

/**
 * True when the latest edition is there and not opened yet: the nav's dot. False while
 * the log loads, so a dot never flashes on and off for a learner who has read it.
 */
export function useTodayUnread(latestDate: string | null | undefined): boolean {
  const { status, state } = useProgress();
  return status === 'ready' && !!latestDate && !state.newsRead.has(latestDate);
}

/** The interests the news is ordered by. Empty until the log is read, and without a profile. */
export function useNewsInterests(): readonly Interest[] {
  const { status, state } = useProgress();
  return status === 'ready' ? (state.profile?.interests ?? NO_INTERESTS) : NO_INTERESTS;
}

/*
 * A record is in flight between the call and the next snapshot. Remembering the dates here
 * keeps a re-render, or Strict Mode's second effect, from writing the same fact twice.
 */
const recording = new Set<string>();

/** Opening an edition is a fact: record news_read for its date, once. */
export function useMarkEditionRead(date: string): void {
  const store = useStore();
  const { status, state } = useProgress();
  const read = state.newsRead.has(date);

  useEffect(() => {
    if (status !== 'ready' || read || recording.has(date)) return;
    recording.add(date);
    // Read state is a nicety: a failed write leaves the edition unread, nothing worse.
    store
      .record('news_read', { date })
      .catch(() => undefined)
      .finally(() => recording.delete(date));
  }, [status, read, date, store]);
}
