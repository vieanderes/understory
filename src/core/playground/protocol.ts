import { z } from 'zod';

/*
 * The one message the preview frame sends to the page. The frame runs learner code, so
 * the page parses every message with these schemas and drops what does not fit. The
 * learner can still forge a report from their own script: the mark is not protected
 * (docs/SANDBOX.md, "Integrity"), only the page is.
 */

export const PLAYGROUND_MESSAGE_SOURCE = 'understory-playground';

/** The tree view stops here; a page for learning is far smaller. */
export const MAX_TREE_ROWS = 200;
const MAX_CHECKS = 20;
const MAX_ERRORS = 5;

const shortText = z.string().max(2000);

export const missedActionSchema = z.strictObject({
  action: z.enum(['click', 'type']),
  selector: shortText,
  invalid: z.literal(true).optional(),
  notField: z.literal(true).optional(),
});

export const checkFactsSchema = z.strictObject({
  count: z.int().min(0),
  invalid: z.literal(true).optional(),
  text: shortText.optional(),
  attribute: shortText.nullable().optional(),
  style: shortText.optional(),
  missed: missedActionSchema.optional(),
});

const attrSchema = z.strictObject({ name: z.string().max(200), value: z.string().max(200) });

export const treeRowSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    depth: z.int().min(0),
    kind: z.literal('element'),
    tag: z.string().max(200),
    attrs: z.array(attrSchema).max(8),
  }),
  z.strictObject({ depth: z.int().min(0), kind: z.literal('text'), text: z.string().max(200) }),
  z.strictObject({ depth: z.int().min(0), kind: z.literal('comment'), text: z.string().max(200) }),
]);

export const probeReportSchema = z.strictObject({
  facts: z.array(checkFactsSchema).max(MAX_CHECKS),
  tree: z.array(treeRowSchema).max(MAX_TREE_ROWS),
  truncated: z.boolean(),
  errors: z.array(z.string().max(500)).max(MAX_ERRORS),
  /** What React's development build warned about, such as a list child without a key. */
  warnings: z.array(z.string().max(500)).max(MAX_ERRORS).optional(),
});

export const playgroundMessageSchema = z.strictObject({
  source: z.literal(PLAYGROUND_MESSAGE_SOURCE),
  nonce: z.string().max(64),
  report: probeReportSchema,
});

export type TreeRow = z.infer<typeof treeRowSchema>;
export type ProbeReport = z.infer<typeof probeReportSchema>;
export type PlaygroundMessage = z.infer<typeof playgroundMessageSchema>;

/** The message, or null for anything that is not one. Never throws. */
export function parsePlaygroundMessage(data: unknown): PlaygroundMessage | null {
  const parsed = playgroundMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
