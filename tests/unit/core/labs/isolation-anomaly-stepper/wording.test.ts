import { describe, expect, it } from 'vitest';
import * as lab from '@/core/labs/isolation-anomaly-stepper';
import type { ScriptLine } from '@/core/labs/isolation-anomaly-stepper';
import type {
  Outcome,
  Scenario,
  Statement,
  TableSchema,
} from '@/core/labs/isolation-anomaly-stepper/types';
import { play } from './helpers';

/*
 * The sentences for cases the shipped scenarios never reach, so a learner who edits the
 * interleaving still reads something true.
 */

const PRODUCTS: TableSchema = { name: 'products', columns: ['id', 'stock'], key: 'id' };
const ALL: Statement = { kind: 'select', table: 'products', where: [], columns: ['id', 'stock'] };
const BEGIN: Statement = { kind: 'begin' };
const COMMIT: Statement = { kind: 'commit' };

const line = (stmt: Statement, sql = 'SQL;'): ScriptLine => ({ sql, stmt });
const done = (extra: Partial<Outcome> = {}): Outcome => ({
  status: 'done',
  step: 1,
  snapshot: [0],
  snapshotStep: 1,
  ...extra,
});

describe('the barrel', () => {
  it('exports the engine, the scenarios and the wording', () => {
    expect(typeof lab.run).toBe('function');
    expect(typeof lab.stepStatus).toBe('function');
    expect(lab.SCENARIO_IDS).toHaveLength(5);
    expect(lab.LEFT_OUT.length).toBeGreaterThan(3);
  });
});

describe('resultText', () => {
  it('counts rows returned and rows changed', () => {
    expect(lab.resultText(line(ALL), done({ rows: [] }))).toBe('no rows');
    expect(lab.resultText(line(ALL), done())).toBe('no rows');
    expect(lab.resultText(line(ALL), done({ rows: [{ id: 1 }, { id: 2 }] }))).toBe('2 rows');
    const update: Statement = { kind: 'update', table: 'products', where: [], set: {} };
    expect(lab.resultText(line(update), done({ count: 0 }))).toBe('changed no rows');
    expect(lab.resultText(line(update), done({ count: 2 }))).toBe('changed 2 rows');
    expect(lab.resultText(line(update), done())).toBe('changed no rows');
    const insert: Statement = { kind: 'insert', table: 'products', values: { id: 3 } };
    expect(lab.resultText(line(insert), done())).toBe('inserted 0 rows');
    const count: Statement = { kind: 'select', table: 'products', where: [], columns: 'count' };
    expect(lab.resultText(line(count), done())).toBe('count 0');
  });
});

describe('sawText', () => {
  it('covers waits, failures and rollbacks without detail', () => {
    expect(lab.sawText(line(ALL), done({ status: 'blocked' }))).toBe('It waits for a row lock.');
    expect(lab.sawText(line(ALL), done({ status: 'failed' }))).toBe('It failed.');
    expect(lab.sawText(line(ALL), done({ status: 'ignored' }))).toBe(
      'It was ignored: the transaction is aborted until it ends.',
    );
    expect(lab.sawText(line({ kind: 'rollback' }), done())).toBe('The transaction rolled back.');
  });

  it('says a waiting read saw the newest version', () => {
    expect(lab.sawText(line(ALL), done({ waitedFor: 1, rows: [{ id: 1, stock: 4 }] }))).toBe(
      'It waited for T1, then read the newest version and saw id 1, stock 4.',
    );
  });

  it('says when the re-evaluated WHERE clause dropped the row', () => {
    const update: Statement = { kind: 'update', table: 'products', where: [], set: {} };
    const outcome = done({ waitedFor: 2, count: 0, rechecks: [{ key: 1, kept: false }] });
    expect(lab.sawText(line(update), outcome)).toBe(
      'It waited for T2, then found that the newest version no longer matched the WHERE clause, so it changed no rows.',
    );
  });
});

describe('the verdict in words, off the shipped path', () => {
  const tables = [PRODUCTS];
  const rows = { products: [{ id: 1, stock: 5 }] };
  const readStock: Statement = { kind: 'select', table: 'products', where: [], columns: ['stock'] };
  const readAll: Statement = { ...readStock, columns: ['id', 'stock'] };
  const setStock: Statement = {
    kind: 'update',
    table: 'products',
    where: [],
    set: { stock: { kind: 'const', value: 4 } },
  };

  it('calls a run with no named pattern simply not serialisable', () => {
    // T1 reads the same row twice with different SQL, so no repeated read is detected.
    const scenario: Scenario = {
      tables,
      rows,
      scripts: { 1: [BEGIN, readStock, readAll, COMMIT], 2: [BEGIN, setStock, COMMIT] },
    };
    const { verdict } = play(scenario, 'read-committed', [1, 1, 2, 2, 2, 1, 1]);
    expect(verdict.anomaly).toBe('not-serialisable');
    expect(lab.verdictHeadline(verdict)).toBe(
      'Neither serial order gives this. Anomaly: no serial order.',
    );
  });

  it('says either order fits when neither transaction changes anything', () => {
    const scenario: Scenario = {
      tables,
      rows,
      scripts: { 1: [BEGIN, readStock, COMMIT], 2: [BEGIN, readStock, COMMIT] },
    };
    const { verdict } = play(scenario, 'read-committed', []);
    expect(lab.verdictHeadline(verdict)).toBe('Same as either serial order. Serialisable.');
    expect(lab.invariantText(verdict)).toBeNull();
  });

  it('says neither ran when both roll back, and names rows a serial order would keep', () => {
    const remove: Statement = { kind: 'delete', table: 'products', where: [] };
    const scenario: Scenario = {
      tables,
      rows,
      scripts: { 1: [BEGIN, remove, COMMIT], 2: [BEGIN, { kind: 'rollback' }] },
    };
    const { end, verdict } = play(scenario, 'read-committed', []);
    const built = { scenario } as lab.Built;
    expect(lab.applicationLine({ lines: { 1: [], 2: [] } } as never, end, 2)).toBe(
      'T2 rolled back.',
    );
    const alone = verdict.serial[0]!;
    expect(
      lab.serialText(built, end, { ...alone, same: false, sameTables: false, tables: rows }),
    ).toBe('T1 alone leaves products: id 1, stock 5.');
    expect(
      lab.serialText(built, end, {
        ...alone,
        order: [],
        same: false,
        sameTables: true,
        observed: { 1: [], 2: [] },
      }),
    ).toBe('Neither transaction leaves the same rows, but it would have read different results.');
    expect(lab.sameStatement(remove, remove)).toBe(true);
  });

  it('lists a row by its columns in schema order', () => {
    expect(lab.tableValues(PRODUCTS, { stock: 5, id: 1 })).toEqual([1, 5]);
  });
});
