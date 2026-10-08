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
  if (pr.requested && NEVER.includes(pr.requested)) return `refuse: ${pr.requested}`;
  if (pr.requested && ASK_FIRST.includes(pr.requested)) return `ask: ${pr.requested}`;
  if (pr.runsSoFar >= pr.maxRuns) return 'hand-off: out of runs';
  if (pr.sameFailureCount >= 2) return 'hand-off: stuck';
  if (pr.ci === 'pending') return 'wait';
  if (pr.ci === 'red') return 'fix-ci';
  if (pr.newComments > 0) return 'answer-comments';
  // A green tick and an approval on an older commit say nothing about this one.
  if (pr.proofCommit !== pr.headCommit) return 'refresh-proof';
  if (pr.approved) return 'stop: done';
  return 'post-status';
}
