/*
 * The frame of an explain-back: who the learner explains to, and what they are asked for.
 * Explaining the same way every time trains one move; a newcomer, a reviewer or an incident
 * channel each need a different answer (docs/WRITING-GUIDE.md, "Judgment and explaining").
 */

export const EXPLAIN_BACK_AUDIENCES = [
  'teammate',
  'newcomer',
  'non-technical',
  'reviewer',
  'interviewer',
  'incident',
] as const;

/** explain: why it happens. decide: defend a choice and its trade-off. risk: what could go wrong. */
export const EXPLAIN_BACK_KINDS = ['explain', 'decide', 'risk'] as const;

export type ExplainBackAudience = (typeof EXPLAIN_BACK_AUDIENCES)[number];
export type ExplainBackKind = (typeof EXPLAIN_BACK_KINDS)[number];

export interface ExplainBackFrame {
  audience: ExplainBackAudience;
  kind: ExplainBackKind;
}

/** The frame an author wrote, with the defaults filled in: a teammate, and why it happens. */
export function explainBackFrame(step: {
  audience?: ExplainBackAudience | undefined;
  kind?: ExplainBackKind | undefined;
}): ExplainBackFrame {
  return { audience: step.audience ?? 'teammate', kind: step.kind ?? 'explain' };
}

const WHO: Record<ExplainBackAudience, string> = {
  teammate: 'a teammate',
  newcomer: 'a newcomer',
  'non-technical': 'someone non-technical',
  reviewer: 'a reviewer',
  interviewer: 'an interviewer',
  incident: 'the incident channel',
};

/** The short label above the prompt, such as "Defend the choice to a reviewer". */
export function explainBackCue(step: {
  audience?: ExplainBackAudience | undefined;
  kind?: ExplainBackKind | undefined;
}): string {
  const { audience, kind } = explainBackFrame(step);
  const who = WHO[audience];
  switch (kind) {
    case 'explain':
      return `Explain it to ${who}`;
    case 'decide':
      return `Defend the choice to ${who}`;
    case 'risk':
      return `Warn ${who}: what could go wrong`;
  }
}

export interface PushBackInput {
  /** The step's prompt, as Markdown. */
  prompt: string;
  /** The frame, as explainBackCue words it. */
  cue: string;
  /** What the learner wrote, as they wrote it. */
  explanation: string;
  rubric: readonly string[];
  /** The model answer, as Markdown. */
  modelAnswer: string;
}

const quote = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`.trimEnd())
    .join('\n');

/*
 * The question sent to Scout when a learner asks it to push back on an explanation they
 * have already compared and marked. One follow-up, the way an interviewer or a senior
 * colleague probes, is the next rep of retrieval; a grade or a rewrite would end it.
 */
export function pushBackQuestion(input: PushBackInput): string {
  return [
    'Push back on my explanation of this step.',
    `Task (${input.cue}):\n${input.prompt.trim()}`,
    `My explanation:\n${quote(input.explanation)}`,
    `The three points it should make:\n${input.rubric.map((point) => `- ${point}`).join('\n')}`,
    `The model answer:\n${input.modelAnswer.trim()}`,
    'Reply with exactly one follow-up question an interviewer or a senior colleague would ask ' +
      'me next, or name the single most important point my explanation misses. ' +
      'Do not grade my answer and do not rewrite it.',
  ].join('\n\n');
}
