import type { RunResult } from '@/core/ports/code-runner';
import * as z from '@/core/zod';

/*
 * The Tutor (docs/SCOUT-ROLES.md, section 6): Scout finds the specific confusion before it
 * explains, fixes only that, and checks with one question the learner answers in a tap.
 * A check is Scout's, not the course's, so answering it records nothing.
 */

export const CHECK_FENCE = 'scout-check';

const line = (max: number) => z.string().trim().min(1).max(max);

export const checkBlockSchema = z
  .object({
    question: line(200),
    options: z
      .array(z.object({ text: line(120), correct: z.boolean(), feedback: line(300) }))
      .min(2)
      .max(4),
  })
  .refine((check) => check.options.filter((o) => o.correct).length === 1, {
    message: 'A check has exactly one right option.',
  });
export type CheckBlock = z.infer<typeof checkBlockSchema>;

export function parseCheckBlock(body: string): CheckBlock | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = checkBlockSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const quote = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n');

export interface StuckInput {
  /** The step's task, as on screen. */
  prompt: string;
  /** The option the learner picked, when they picked one. */
  picked?: string;
  /** The course's feedback on that pick: the misconception it names. */
  feedback?: string;
  /** A failing run's output, when they ran code. */
  run?: string;
}

/** The question sent when the learner asks Scout about a wrong answer or a failing run. */
export function stuckQuestion(input: StuckInput): string {
  return [
    'I got this wrong and want to understand why.',
    `The task:\n${input.prompt.trim()}`,
    ...(input.picked ? [`I picked:\n${quote(input.picked)}`] : []),
    ...(input.feedback ? [`The lesson said:\n${quote(input.feedback)}`] : []),
    ...(input.run ? [`My last run:\n${quote(input.run)}`] : []),
    'Find out what I am getting wrong before you explain: ask me one short question if you need to.',
  ].join('\n\n');
}

type ConceptState = 'unseen' | 'assumed' | 'introduced' | 'practised' | 'solid' | 'fluent' | 'gap';

const STATE_WORDS: Record<Exclude<ConceptState, 'unseen'>, string> = {
  assumed: 'assumed known from placement',
  introduced: 'just introduced',
  practised: 'practised',
  solid: 'solid',
  fluent: 'fluent',
  gap: 'was solid, has slipped (a gap)',
};

export interface TutorEvidenceInput {
  concepts: readonly { title: string; state: ConceptState }[];
  /** Steps of this lesson answered wrongly with confidence, latest last. */
  misses: readonly { prompt: string; confidence: 'fairly' | 'certain' }[];
}

/**
 * What the learner's record says about this lesson, for the Tutor's context. A wrong answer
 * given with confidence is the clearest sign of a misconception rather than a slip.
 */
export function tutorEvidence(input: TutorEvidenceInput): string {
  const concepts = input.concepts.flatMap((c) =>
    c.state === 'unseen' ? [] : [`- ${c.title}: ${STATE_WORDS[c.state]}`],
  );
  const misses = input.misses.map(
    (m) =>
      `- Answered wrongly while ${m.confidence === 'certain' ? 'certain' : 'fairly sure'}: ${m.prompt}`,
  );
  return [...(concepts.length ? ['Concepts in this lesson:', ...concepts] : []), ...misses].join(
    '\n',
  );
}

const FAILURES_SHOWN = 5;

/** A run as the Tutor reads it: what fails and why, never the tests' source. */
export function runSummary(result: RunResult): string {
  const failing = result.tests.filter((t) => !t.passed);
  const { error } = result;
  return [
    ...(result.status === 'timeout' ? ['The run ran out of time.'] : []),
    ...(result.tests.length ? [`${failing.length} of ${result.tests.length} tests fail.`] : []),
    ...failing
      .slice(0, FAILURES_SHOWN)
      .map((t) => `- ${t.name}${t.message ? `: ${t.message}` : ''}`),
    ...(error
      ? [`${error.name}${error.line ? ` on line ${error.line}` : ''}: ${error.message}`]
      : []),
  ].join('\n');
}
