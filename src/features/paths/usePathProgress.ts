'use client';

import { placedOut, placementKnows } from '@/core/placement';
import { useProgress } from '@/features/store/StoreProvider';
import type { PathSummary } from '@/lib/content';

export interface PathProgress {
  ready: boolean;
  done: number;
  total: number;
  /** The first lesson not done and not placed out, or undefined once nothing is left. */
  nextId: string | undefined;
  isDone: (lessonId: string) => boolean;
  /** Placement showed every concept of the lesson. It stays on the path, and is skipped. */
  isPlacedOut: (lessonId: string) => boolean;
}

/** How far through a path, read from the progress log on this device. */
export function usePathProgress(path: Pick<PathSummary, 'lessonIds' | 'stages'>): PathProgress {
  const { status, state } = useProgress();
  const ready = status === 'ready';
  const isDone = (id: string) => ready && state.completedLessons.has(id);
  const knows = placementKnows(state);
  const concepts = new Map(path.stages.flatMap((s) => s.lessons).map((l) => [l.id, l.concepts]));
  const isPlacedOut = (id: string) =>
    ready && !isDone(id) && placedOut(concepts.get(id) ?? [], knows);
  const done = path.lessonIds.filter(isDone).length;
  return {
    ready,
    done,
    total: path.lessonIds.length,
    nextId: path.lessonIds.find((id) => !isDone(id) && !isPlacedOut(id)),
    isDone,
    isPlacedOut,
  };
}
