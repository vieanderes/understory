import { describe, expect, it } from 'vitest';
import { gradeSql } from '@/core/sql/grade';
import type { SqlResultSet, SqlRunReport, SqlStatementResult } from '@/core/sql/report';
import { sqlVerdict, subjectOf } from '@/core/sql/verdict';

const result = (rows: string[][], columns = ['id', 'customer']): SqlResultSet => ({
  columns,
  rows,
  rowCount: rows.length,
});

const select = (rows: string[][], line = 1): SqlStatementResult => ({
  status: 'ok',
  line,
  text: 'select id, customer from orders',
  command: 'SELECT',
  result: result(rows),
  ms: 1,
});

const insert: SqlStatementResult = {
  status: 'ok',
  line: 1,
  text: "insert into orders values (3, 'Cy')",
  command: 'INSERT',
  affected: 1,
  ms: 1,
};

type Ran = Extract<SqlRunReport, { status: 'ran' }>;

const ran = (statements: SqlStatementResult[], extra: Partial<Ran> = {}): Ran => ({
  status: 'ran',
  statements,
  skipped: 0,
  ...extra,
});

const ben = [['2', 'Ben']];
const expected = ran([select(ben)]);

describe('subjectOf', () => {
  it('is the last statement that returned rows', () => {
    expect(subjectOf(ran([select([['1', 'Ana']]), insert, select(ben)]), {})).toEqual({
      result: result(ben),
    });
    expect(subjectOf(ran([insert]), {})).toEqual({ none: true });
  });

  it('is the check query when the step has one', () => {
    const report = ran([insert], { query: { result: result(ben) } });
    expect(subjectOf(report, { query: 'select * from orders' })).toEqual({ result: result(ben) });
  });
});

describe('sqlVerdict', () => {
  it('matches when the last result equals the solution’s', () => {
    expect(sqlVerdict(ran([select(ben)]), expected, {})).toEqual({ status: 'match' });
  });

  it('lists the differences when it does not', () => {
    expect(sqlVerdict(ran([select([['1', 'Ana'], ...ben])]), expected, {})).toEqual({
      status: 'mismatch',
      differences: ['Expected 1 row, got 2.', 'An extra row: (1, Ana).'],
    });
  });

  it('respects ordered', () => {
    const two = ran([select([['1', 'Ana'], ...ben])]);
    const flipped = ran([select([...ben, ['1', 'Ana']])]);
    expect(sqlVerdict(flipped, two, {}).status).toBe('match');
    expect(sqlVerdict(flipped, two, { ordered: true }).status).toBe('mismatch');
  });

  it('is an error, with Postgres’s message and line, when a statement failed', () => {
    const failed = ran([
      {
        status: 'error',
        line: 2,
        text: 'selct 1',
        error: { message: 'syntax error at or near "selct"', line: 2, column: 1 },
      },
    ]);
    expect(sqlVerdict(failed, expected, {})).toEqual({
      status: 'error',
      message: 'Line 2: syntax error at or near "selct"',
    });
  });

  it('is an error when nothing returned rows to compare', () => {
    expect(sqlVerdict(ran([insert]), expected, {})).toEqual({
      status: 'error',
      message: 'Your SQL returned no rows to compare. End it with a select.',
    });
  });

  it('reads the check query, and reports when it fails after the learner’s SQL', () => {
    const checks = { query: 'select id, customer from orders' };
    const after = ran([insert], { query: { result: result(ben) } });
    expect(sqlVerdict(after, after, checks)).toEqual({ status: 'match' });
    const broken = ran([insert], {
      query: { error: { message: 'relation "orders" does not exist' } },
    });
    expect(sqlVerdict(broken, after, checks)).toEqual({
      status: 'error',
      message: 'The check after your SQL failed: relation "orders" does not exist',
    });
  });

  it('is an error when the run timed out', () => {
    expect(sqlVerdict({ status: 'timeout', limitMs: 5000 }, expected, {})).toEqual({
      status: 'error',
      message: 'Your SQL ran for more than 5 seconds and was stopped.',
    });
  });

  it('gives no verdict when the database or the solution could not answer', () => {
    expect(sqlVerdict({ status: 'unavailable', reason: 'offline' }, expected, {})).toEqual({
      status: 'unavailable',
      reason: 'offline',
    });
    expect(sqlVerdict(ran([select(ben)]), ran([insert]), {}).status).toBe('unavailable');
    expect(
      sqlVerdict({ status: 'setup-error', error: { message: 'no' } }, expected, {}).status,
    ).toBe('unavailable');
    expect(sqlVerdict(ran([select(ben)]), { status: 'timeout', limitMs: 1 }, {}).status).toBe(
      'unavailable',
    );
  });
});

describe('gradeSql', () => {
  it('scores a match as right and anything else as wrong, with the reasons', () => {
    expect(gradeSql({ status: 'match' })).toMatchObject({ correct: true, score: 1, feedback: [] });
    expect(gradeSql({ status: 'mismatch', differences: ['Expected 1 row, got 2.'] })).toMatchObject(
      {
        correct: false,
        score: 0,
        feedback: [{ kind: 'result', message: 'Expected 1 row, got 2.' }],
      },
    );
    expect(gradeSql({ status: 'error', message: 'Line 1: boom' })).toMatchObject({
      correct: false,
      feedback: [{ kind: 'error', message: 'Line 1: boom' }],
    });
    expect(gradeSql({ status: 'unavailable', reason: 'offline' })).toMatchObject({
      correct: false,
      feedback: [{ kind: 'unavailable', message: 'offline' }],
    });
  });
});
