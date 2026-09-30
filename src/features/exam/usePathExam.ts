'use client';

import { pathExamResult, type PathExamResult } from '@/core/exam';
import { useProgress } from '@/features/store/StoreProvider';

/** A path's final exam as the log on this device tells it: sittings, best, passed. */
export function usePathExam(pathId: string): PathExamResult & { ready: boolean } {
  const { status, state } = useProgress();
  const ready = status === 'ready';
  return { ready, ...pathExamResult(ready ? state.pathExams[pathId] : undefined) };
}
