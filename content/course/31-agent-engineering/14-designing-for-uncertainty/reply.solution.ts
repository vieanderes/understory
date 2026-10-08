export type Request = {
  kind: 'question' | 'action';
  ambiguous: boolean;
  costlyIfWrong: boolean;
  confidence: number;
  reversible: boolean;
};

export type Reply = 'answer' | 'answer-with-sources' | 'ask' | 'preview-then-act' | 'hand-off';

export function decideReply(request: Request): Reply {
  // A cheap wrong guess is fixed in one more message; a costly one is not.
  if (request.ambiguous && request.costlyIfWrong) return 'ask';
  if (request.confidence < 0.5) return 'hand-off';
  if (request.kind === 'action') {
    // Nothing to undo means the agent has to be surer before it even offers to act.
    if (!request.reversible && request.confidence < 0.8) return 'hand-off';
    return 'preview-then-act';
  }
  if (request.confidence >= 0.9 && !request.costlyIfWrong) return 'answer';
  return 'answer-with-sources';
}
