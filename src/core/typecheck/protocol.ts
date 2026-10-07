import * as z from '@/core/zod';
import { LIMITS } from '../running/limits';

/*
 * The messages between the page and the type-checker worker. The worker is the app's own
 * code and runs no learner code, so this is about catching a stale or broken worker file,
 * not an attacker: the page checks every reply and treats a bad one as "unavailable".
 */

const source = z.string().max(LIMITS.maxSourceBytes);

export const checkRequestSchema = z.strictObject({
  v: z.literal(1),
  id: z.int().nonnegative(),
  code: source,
  tests: source,
});

export const rawDiagnosticSchema = z.strictObject({
  file: z.enum(['code', 'tests', 'other']),
  start: z.int().nonnegative().optional(),
  length: z.int().nonnegative().optional(),
  code: z.int(),
  category: z.enum(['error', 'warning', 'suggestion', 'message']),
  message: z.string(),
});

export const checkReplySchema = z.union([
  z.strictObject({
    v: z.literal(1),
    id: z.int().nonnegative(),
    diagnostics: z.array(rawDiagnosticSchema).max(1000),
  }),
  z.strictObject({ v: z.literal(1), id: z.int().nonnegative(), failure: z.string() }),
]);

export type CheckRequest = z.infer<typeof checkRequestSchema>;
export type CheckReply = z.infer<typeof checkReplySchema>;
