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
