'use client';

import { useMemo } from 'react';
import { overview, type Overview } from '@/core/insight';
import { localDateOf } from '@/features/store/progress-store';
import { useProgress } from '@/features/store/StoreProvider';
import { useCatalog } from './useCatalog';
import { useNow } from './useNow';

export type OverviewStatus = 'loading' | 'ready' | 'failed';

/** The learner's whole picture, or the reason it is not there yet. */
export function useOverview(): { status: OverviewStatus; view: Overview | null } {
  const { status, state } = useProgress();
  const { catalog, failed } = useCatalog();
  const now = useNow();

  const view = useMemo(
    () =>
      status === 'ready' && catalog && now ? overview(catalog, state, now, localDateOf(now)) : null,
    [status, state, catalog, now],
  );

  return { status: failed ? 'failed' : view ? 'ready' : 'loading', view };
}
