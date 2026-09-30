import type { Issue, RawLesson } from '../../src/core/content/catalog';
import type { CodeChallengeStep } from '../../src/core/content/schema';

/*
 * The solution gate: every reference solution passes its tests, and every starter fails
 * them. A challenge that breaks either half teaches nothing or cannot be finished.
 *
 * The check needs a code runner. The Node runner (`NodeWorkerRunner`, milestone M4) plugs
 * in here: build a `SolutionGate` that runs `files.solution` and then `files.starter`
 * against `files.tests`, returns an issue for each half that fails, and pass it to
 * `checkContent` in scripts/validate-content.ts. Until then the default gate lets every
 * challenge through, so the validator already calls the hook for each challenge and the
 * runner arrives without a change to the CLI.
 */

export interface ChallengeSources {
  starter: string;
  solution: string;
  tests: string;
  /** Assessment tasks only. */
  hidden?: string;
  performance?: string;
  bruteForce?: string;
}

export type SolutionGate = (
  lesson: RawLesson,
  step: CodeChallengeStep,
  files: ChallengeSources,
) => Promise<Issue[]>;

export const noSolutionGate: SolutionGate = () => Promise.resolve([]);
