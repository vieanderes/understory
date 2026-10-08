import * as z from '@/core/zod';

/*
 * The Editor (docs/SCOUT-ROLES.md, section 7): feedback on the learner's own work, when they
 * ask, on their latest version. It quotes them, gives at most three notes and one next step,
 * and never rewrites the work or scores it.
 */

export const REVIEW_FENCE = 'scout-review';

const line = (max: number) => z.string().trim().min(1).max(max);

export const reviewBlockSchema = z.object({
  notes: z
    .array(
      z.object({
        tag: z.enum(['keep', 'fix', 'missing']),
        /** The learner's own words or lines the note is about. */
        quote: z.string().trim().max(300).optional(),
        note: line(300),
      }),
    )
    .min(1)
    .max(3),
  next: line(200),
});
export type ReviewBlock = z.infer<typeof reviewBlockSchema>;

export function parseReviewBlock(body: string): ReviewBlock | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = reviewBlockSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const quote = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n');

export interface EditorInput {
  /** The task, as on screen. */
  task: string;
  /** The learner's code, as it is now. */
  work: string;
  language: string;
  /** Their last run, in words (runSummary). */
  run?: string;
  /** The version they asked about before, when they have revised since. */
  previous?: string;
}

/** The question sent when the learner asks Scout to review their code. */
export function editorRequest(input: EditorInput): string {
  const fence = (code: string) => `\`\`\`${input.language}\n${code.trim()}\n\`\`\``;
  return [
    'Review my code as an editor would.',
    `The task:\n${input.task.trim()}`,
    `My code:\n${fence(input.work)}`,
    ...(input.run ? [`My last run:\n${quote(input.run)}`] : []),
    ...(input.previous
      ? [`My earlier version:\n${fence(input.previous)}`, 'Say first what changed since then.']
      : []),
    'Do not rewrite it for me.',
  ].join('\n\n');
}
