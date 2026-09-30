import type { PathExamAttempt } from '@/core/progress/reducer';
import { pathExamPassed } from './exam';

export interface PathExamResult {
  readonly attempts: number;
  /** The attempt with the highest share right. The earliest wins a tie. */
  readonly best: PathExamAttempt | undefined;
  readonly passed: boolean;
  /**
   * The first attempt at 80% or more. The certificate is issued from it and never changes
   * after, so its date and verification code stay the same whatever comes later.
   */
  readonly firstPass: PathExamAttempt | undefined;
}

/** Derived from the recorded sittings of one path (`ProgressState.pathExams[id]`). */
export function pathExamResult(attempts: readonly PathExamAttempt[] | undefined): PathExamResult {
  const all = attempts ?? [];
  const share = (a: PathExamAttempt) => a.right / a.total;
  const best = all
    .filter((a) => a.total > 0)
    .reduce<PathExamAttempt | undefined>(
      (top, a) => (!top || share(a) > share(top) ? a : top),
      undefined,
    );
  const firstPass = all.find((a) => pathExamPassed(a.right, a.total));
  return { attempts: all.length, best, passed: firstPass !== undefined, firstPass };
}
