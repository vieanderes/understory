'use client';

import { useProgress } from '@/features/store/StoreProvider';

export interface PathProgress {
  ready: boolean;
  done: number;
  total: number;
  /** The first lesson not done yet, or undefined once the path is finished. */
  nextId: string | undefined;
  isDone: (lessonId: string) => boolean;
}

/** How far through a path, read from the progress log on this device. */
export function usePathProgress(lessonIds: readonly string[]): PathProgress {
  const { status, state } = useProgress();
  const ready = status === 'ready';
  const isDone = (id: string) => ready && state.completedLessons.has(id);
  const done = lessonIds.filter(isDone).length;
  return {
    ready,
    done,
    total: lessonIds.length,
    nextId: lessonIds.find((id) => !isDone(id)),
    isDone,
  };
}
