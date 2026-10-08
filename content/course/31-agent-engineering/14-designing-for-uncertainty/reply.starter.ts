export type Request = {
  kind: 'question' | 'action';
  ambiguous: boolean;
  costlyIfWrong: boolean;
  confidence: number;
  reversible: boolean;
};

export type Reply = 'answer' | 'answer-with-sources' | 'ask' | 'preview-then-act' | 'hand-off';

export function decideReply(request: Request): Reply {
  // Ask, hand off, actions, then questions: the order matters.
  if (request.confidence >= 0.9) return 'answer';
  return 'answer-with-sources';
}
