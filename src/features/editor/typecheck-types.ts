import type { RefObject } from 'react';
import type { RunResult } from '@/core/ports/code-runner';

/*
 * Types only, so the lesson route that renders a code step pays nothing for them. The
 * checker, its CodeMirror extension and the list of errors arrive in a chunk of their own,
 * and only for a type-checked step (./typecheck/TypecheckLayer.tsx).
 */

/** What the step asks of the checker when the learner runs the tests. */
export interface TypecheckHandle {
  /**
   * Starts checking `code` at once, beside the test run, and returns what finishes it: the
   * run, with the checker's verdict added as a check in front of the tests
   * (src/core/typecheck/verdict.ts). That resolves to the run unchanged when the checker
   * is not available, so it never blocks a run.
   */
  begin(code: string): (result: RunResult) => Promise<RunResult>;
}

export interface EditorTypecheck {
  /** The step's tests: context for the checker, never shown as errors. */
  tests: string;
  /** Filled in once the checker's chunk has loaded. Empty until then. */
  handleRef?: RefObject<TypecheckHandle | null>;
}
