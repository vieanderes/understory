import * as z from '@/core/zod';

/*
 * Guided mode (docs/ONLINE-TEST.md, "Guided mode"): a coach beside the IDE that walks one
 * task along the path a strong candidate takes. Each step says what to do and why: what to
 * read and put into your own words, what to ask the AI assistant and when, what to type
 * yourself, what to let the assistant write and how to check it, when to run, which edge
 * cases to add, and when to stop and submit.
 *
 * The guide is the answer, so it lives apart from the task and loads only when guided mode
 * is on. The build proves its last full solution scores 100% in both languages, so a guide
 * can never walk anyone to a wrong answer.
 */

export const GUIDE_STEP_KINDS = [
  'read',
  'explain',
  'edge-cases',
  'plan',
  'ask-ai',
  'ai-writes',
  'write',
  'run',
  'test',
  'optimise',
  'review',
  'submit',
] as const;
export type GuideStepKind = (typeof GUIDE_STEP_KINDS)[number];

/** How the coach names each kind, as the label above a step. */
export const GUIDE_KIND_LABEL: Record<GuideStepKind, string> = {
  read: 'Read',
  explain: 'Explain it back',
  'edge-cases': 'Edge cases',
  plan: 'Plan',
  'ask-ai': 'Ask the AI',
  'ai-writes': 'Let the AI write',
  write: 'Write it yourself',
  run: 'Run',
  test: 'Test',
  optimise: 'Optimise',
  review: 'Review',
  submit: 'Submit',
};

const text = (hint: string) => z.string().trim().min(1, hint).describe(hint);

const codeSchema = z.strictObject({
  ts: text('The code in TypeScript. JavaScript is derived from it by stripping the types.'),
  python: text('The same code in Python.'),
});

export const guideStepSchema = z.strictObject({
  kind: z.enum(GUIDE_STEP_KINDS),
  title: text('What to do, in a few words: "Restate the task in one sentence".'),
  body: text('Markdown: what to do and why it matters. Short, one idea.'),
  minutes: z.number().min(0.5).max(30).optional().describe('A time budget for this step.'),
  prompt: text('What to send the AI assistant, word for word.')
    .optional()
    .describe('Only for ask-ai and ai-writes steps.'),
  code: codeSchema.optional(),
  /**
   * `full`: the whole solution as it should stand after this step, which the candidate may
   * load into the editor. `snippet`: a fragment to read or type.
   */
  codeMode: z.enum(['snippet', 'full']).optional(),
  /** Lines to add to test-input.txt, in the platform's format. */
  input: z.array(z.string().min(1)).max(10).optional(),
  /** What the candidate should see when the step is done: the check that it worked. */
  expect: text('What you should see when this step worked.').optional(),
});
export type GuideStep = z.infer<typeof guideStepSchema>;

export const guideFileSchema = z
  .strictObject({
    approach: text('One paragraph: the idea that solves the task, in plain words.'),
    complexity: text('The target, such as "O(N) time, O(1) extra space".'),
    steps: z.array(guideStepSchema).min(6).max(20),
  })
  .superRefine((guide, ctx) => {
    guide.steps.forEach((step, i) => {
      if ((step.kind === 'ask-ai' || step.kind === 'ai-writes') && !step.prompt) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'prompt'],
          message: 'An AI step needs the prompt to send.',
        });
      }
      if (step.code && !step.codeMode) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'codeMode'],
          message: 'Say whether the code is the full solution or a snippet.',
        });
      }
    });
    if (!guide.steps.some((s) => s.codeMode === 'full')) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'A guide needs at least one full solution step.',
      });
    }
    if (guide.steps.at(-1)?.kind !== 'submit') {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'A guide ends with the submit step.',
      });
    }
  });
export type GuideFile = z.infer<typeof guideFileSchema>;

/** The compiled guide the app fetches: markdown rendered, code in all three languages. */
export const compiledGuideStepSchema = z.strictObject({
  kind: z.enum(GUIDE_STEP_KINDS),
  title: z.string(),
  bodyHtml: z.string(),
  minutes: z.number().optional(),
  prompt: z.string().optional(),
  code: z.strictObject({ js: z.string(), ts: z.string(), python: z.string() }).optional(),
  codeMode: z.enum(['snippet', 'full']).optional(),
  input: z.array(z.string()).optional(),
  expect: z.string().optional(),
});
export type CompiledGuideStep = z.infer<typeof compiledGuideStepSchema>;

export const compiledTaskGuideSchema = z.strictObject({
  taskId: z.string(),
  approachHtml: z.string(),
  complexity: z.string(),
  steps: z.array(compiledGuideStepSchema),
});
export type CompiledTaskGuide = z.infer<typeof compiledTaskGuideSchema>;

/** The last full solution of a guide: what the gate scores and the final step leads to. */
export function finalSolution(guide: Pick<GuideFile, 'steps'>): GuideStep['code'] {
  return guide.steps.findLast((s) => s.codeMode === 'full' && s.code)?.code;
}
