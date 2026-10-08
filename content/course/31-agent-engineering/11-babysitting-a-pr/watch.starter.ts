export type PrSnapshot = {
  ci: 'green' | 'red' | 'pending';
  approved: boolean;
  newComments: number;
  runsSoFar: number;
  maxRuns: number;
  sameFailureCount: number;
  headCommit: string;
  proofCommit: string;
  requested?: string;
};

export const NEVER = ['merge', 'deploy', 'force-push-others', 'loosen-check', 'resolve-own-review'];
export const ASK_FIRST = ['edit-outside-scope', 'change-dependency', 'disagree-with-reviewer'];

export function nextAction(pr: PrSnapshot): string {
  // Gates first, then the stop conditions, then the work.
  if (pr.ci === 'green' && pr.approved) return 'stop: done';
  return 'wait';
}
