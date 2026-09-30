import type { CompiledStep } from '@/core/content/compiled';
import type { Answer, Grade } from '@/core/grading';
import type { CheckResult } from '@/core/playground';
import type { RunResult } from '@/core/ports/code-runner';
import type { SqlVerdict } from '@/core/sql';

/**
 * What the player and a step component agree on.
 *
 * The player owns the flow: which step is showing, the confidence control, the Check and
 * Continue bar, grading, and recording. A step component owns only its own input. It
 * reports the learner's current answer upward (null while incomplete) and, once the
 * player has checked it, shows what was right and why.
 */
export type Phase = 'answering' | 'checked';

/** Code challenges are graded from a run, not from an Answer. */
export interface RunSubmission {
  readonly type: 'code-challenge';
  readonly result: RunResult;
  readonly hintsUsed: number;
  readonly revealed: boolean;
}

/** A playground is graded from its checklist, judged live against the rendered page. */
export interface PlaygroundSubmission {
  readonly type: 'playground';
  readonly results: readonly CheckResult[];
  readonly hintsUsed: number;
}

/**
 * A sql step is graded from its last run, the learner's result against the solution's,
 * with `gradeSql` applied by the step: the grade arrives ready.
 */
export interface SqlSubmission {
  readonly type: 'sql';
  readonly verdict: SqlVerdict;
  readonly grade: Grade;
  readonly hintsUsed: number;
}

/** Explain-back is self-graded after the model answer is shown. */
export type Submission = Answer | RunSubmission | PlaygroundSubmission | SqlSubmission;

export interface StepProps<S extends CompiledStep = CompiledStep> {
  step: S;
  phase: Phase;
  /** Present once phase is 'checked'. */
  grade?: Grade;
  /**
   * False while a second try is still on offer: the step marks what was wrong and says
   * why, but must not give the right answer away. True once the attempt is over.
   */
  reveal: boolean;
  /** The lesson the step belongs to. Drafts and deep links are keyed by lesson and step. */
  lessonId?: string;
  /** Seeds any shuffling, so a re-render or a revisit shows the same order. */
  seed: number;
  /**
   * 1 on the first try, 2 on the second. A step may ease the second try: Parsons drops a
   * distractor (Ericson et al. 2018, adaptive Parsons problems). Absent means 1.
   */
  tryNumber?: number;
  /**
   * Code challenges only: where this lesson's reference solutions can be fetched, for the
   * explicit "Show solution" action. Absent when the lesson has none.
   */
  solutionsUrl?: string;
  /** Call with the current answer, or null while it is incomplete. */
  onSubmissionChange: (submission: Submission | null) => void;
  /** Steps with their own run or reveal flow ask the player to check right now. */
  requestCheck: () => void;
}
