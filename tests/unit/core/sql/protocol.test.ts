import { describe, expect, it } from 'vitest';
import { SQL_LIMITS, sqlWorkerReplySchema, sqlWorkerRequestSchema } from '@/core/sql';

describe('the SQL worker protocol', () => {
  it('accepts a run request and refuses unknown keys or oversized SQL', () => {
    const request = { v: 1, id: 0, request: { setup: 'create table t (a int);', sql: 'select 1' } };
    expect(sqlWorkerRequestSchema.safeParse(request).success).toBe(true);
    expect(sqlWorkerRequestSchema.safeParse({ ...request, extra: 1 }).success).toBe(false);
    const huge = {
      ...request,
      request: { setup: '', sql: 'x'.repeat(SQL_LIMITS.maxSourceBytes + 1) },
    };
    expect(sqlWorkerRequestSchema.safeParse(huge).success).toBe(false);
  });

  it('accepts each reply the worker sends and nothing else', () => {
    expect(sqlWorkerReplySchema.safeParse({ v: 1, kind: 'ready' }).success).toBe(true);
    expect(
      sqlWorkerReplySchema.safeParse({ v: 1, kind: 'failed', reason: 'no wasm' }).success,
    ).toBe(true);
    const report = {
      v: 1,
      kind: 'report',
      id: 3,
      report: {
        status: 'ran',
        skipped: 1,
        statements: [
          {
            status: 'ok',
            line: 1,
            text: 'select 1',
            command: 'SELECT',
            result: { columns: ['?column?'], rows: [['1']], rowCount: 1 },
            ms: 0.4,
          },
          {
            status: 'error',
            line: 2,
            text: 'selct',
            error: { message: 'syntax error', code: '42601' },
          },
        ],
        schema: [
          {
            name: 't',
            columns: [{ name: 'a', type: 'integer', notNull: false, primaryKey: false }],
          },
        ],
      },
    };
    expect(sqlWorkerReplySchema.safeParse(report).success).toBe(true);
    expect(sqlWorkerReplySchema.safeParse({ v: 2, kind: 'ready' }).success).toBe(false);
    expect(
      sqlWorkerReplySchema.safeParse({ ...report, report: { status: 'ran', statements: 'x' } })
        .success,
    ).toBe(false);
  });
});
