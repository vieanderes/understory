import * as z from '@/core/zod';
import { SQL_LIMITS } from './limits';
import type { SqlRunReport } from './report';

/*
 * The messages between the page and the SQL worker. The worker is the app's own code,
 * so this catches a stale or broken worker file rather than an attacker: the page checks
 * every message and treats a bad one as "unavailable".
 */

const source = z.string().max(SQL_LIMITS.maxSourceBytes);

export const sqlRunRequestSchema = z.strictObject({
  setup: source,
  sql: source,
  query: source.optional(),
  describe: z.boolean().optional(),
});

export const sqlWorkerRequestSchema = z.strictObject({
  v: z.literal(1),
  id: z.int().nonnegative(),
  request: sqlRunRequestSchema,
});

const cell = z.string().nullable();

const resultSetSchema = z.strictObject({
  columns: z.array(z.string()),
  rows: z.array(z.array(cell)).max(SQL_LIMITS.maxRows),
  rowCount: z.int().nonnegative(),
  truncated: z.boolean().optional(),
});

const errorSchema = z.strictObject({
  message: z.string(),
  code: z.string().optional(),
  detail: z.string().optional(),
  hint: z.string().optional(),
  line: z.int().positive().optional(),
  column: z.int().positive().optional(),
});

const statementSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('ok'),
    line: z.int().positive(),
    text: z.string(),
    command: z.string(),
    result: resultSetSchema.optional(),
    affected: z.int().nonnegative().optional(),
    ms: z.number().nonnegative(),
  }),
  z.strictObject({
    status: z.literal('error'),
    line: z.int().positive(),
    text: z.string(),
    error: errorSchema,
  }),
]);

const tableSchema = z.strictObject({
  name: z.string(),
  columns: z.array(
    z.strictObject({
      name: z.string(),
      type: z.string(),
      notNull: z.boolean(),
      primaryKey: z.boolean(),
      references: z.string().optional(),
    }),
  ),
});

export const sqlRunReportSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('ran'),
    statements: z.array(statementSchema).max(SQL_LIMITS.maxStatements),
    skipped: z.int().nonnegative(),
    query: z
      .union([z.strictObject({ result: resultSetSchema }), z.strictObject({ error: errorSchema })])
      .optional(),
    schema: z.array(tableSchema).optional(),
  }),
  z.strictObject({ status: z.literal('setup-error'), error: errorSchema }),
  z.strictObject({ status: z.literal('timeout'), limitMs: z.int().positive() }),
  z.strictObject({ status: z.literal('unavailable'), reason: z.string() }),
]) satisfies z.ZodType<SqlRunReport>;

export const sqlWorkerReplySchema = z.discriminatedUnion('kind', [
  /** Postgres is up; runs from now on get the warm budget. */
  z.strictObject({ v: z.literal(1), kind: z.literal('ready') }),
  z.strictObject({ v: z.literal(1), kind: z.literal('failed'), reason: z.string() }),
  z.strictObject({
    v: z.literal(1),
    kind: z.literal('report'),
    id: z.int().nonnegative(),
    report: sqlRunReportSchema,
  }),
]);

export type SqlWorkerRequest = z.infer<typeof sqlWorkerRequestSchema>;
export type SqlWorkerReply = z.infer<typeof sqlWorkerReplySchema>;
