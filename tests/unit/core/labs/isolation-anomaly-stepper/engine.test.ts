import { describe, expect, it } from 'vitest';
import {
  allFinished,
  canRun,
  initialState,
  paramName,
  step,
  validateScenario,
} from '@/core/labs/isolation-anomaly-stepper/engine';
import { committedTables } from '@/core/labs/isolation-anomaly-stepper/mvcc';
import type {
  EngineState,
  Level,
  Scenario,
  Statement,
  TableSchema,
  TxId,
} from '@/core/labs/isolation-anomaly-stepper/types';
import { errors, play, statuses } from './helpers';

/*
 * The rules of the engine, each against PostgreSQL chapter 13. Cross-checked against
 * PostgreSQL 17.11 in Docker with two psql sessions driven through named pipes.
 */

const TICKETS: TableSchema = {
  name: 'tickets',
  columns: ['id', 'sold', 'capacity'],
  key: 'id',
};

const ROW = { id: 1, sold: 11, capacity: 12 };

function scenarioOf(
  one: readonly Statement[],
  two: readonly Statement[],
  extra: Partial<Scenario> = {},
): Scenario {
  return {
    tables: [TICKETS],
    rows: { tickets: [ROW] },
    scripts: { 1: one, 2: two },
    ...extra,
  };
}

const BEGIN: Statement = { kind: 'begin' };
const COMMIT: Statement = { kind: 'commit' };
const ROLLBACK: Statement = { kind: 'rollback' };
const ID_1 = [{ col: 'id', op: '=' as const, value: 1 }];
const READ_SOLD: Statement = {
  kind: 'select',
  table: 'tickets',
  where: ID_1,
  columns: ['sold'],
};
const ADD_ONE: Statement = {
  kind: 'update',
  table: 'tickets',
  where: ID_1,
  set: { sold: { kind: 'add', n: 1 } },
};

describe('validateScenario', () => {
  const bad =
    (one: readonly Statement[], two: readonly Statement[] = [BEGIN, COMMIT]) =>
    () =>
      validateScenario(scenarioOf(one, two));

  it('insists on BEGIN first and one COMMIT or ROLLBACK last', () => {
    expect(bad([READ_SOLD, COMMIT])).toThrow('must start with BEGIN');
    expect(bad([BEGIN, READ_SOLD])).toThrow('must end with COMMIT or ROLLBACK');
    expect(bad([BEGIN, COMMIT, READ_SOLD])).toThrow('must end with COMMIT or ROLLBACK');
    expect(bad([BEGIN])).toThrow('must end with COMMIT or ROLLBACK');
  });

  it('rejects an unknown table and a duplicate key', () => {
    expect(bad([BEGIN, { ...READ_SOLD, table: 'seats' }, COMMIT])).toThrow('Unknown table "seats"');
    const insert: Statement = { kind: 'insert', table: 'tickets', values: { id: 1, sold: 0 } };
    expect(bad([BEGIN, insert, COMMIT])).toThrow('Duplicate key tickets/1');
  });

  it('rejects a row with no primary key', () => {
    expect(() =>
      validateScenario({
        tables: [TICKETS],
        rows: { tickets: [{ sold: 1 }] },
        scripts: { 1: [BEGIN, COMMIT], 2: [BEGIN, COMMIT] },
      }),
    ).toThrow('has no "id"');
  });

  // PostgreSQL: "FOR UPDATE is not allowed with aggregate functions" (SQLSTATE 0A000).
  it('rejects FOR UPDATE with an aggregate', () => {
    const stmt: Statement = {
      kind: 'select',
      table: 'tickets',
      where: [],
      columns: 'count',
      forUpdate: true,
    };
    expect(bad([BEGIN, stmt, COMMIT])).toThrow('aggregate functions');
  });
});

describe('the initial state', () => {
  it('holds the seed rows as versions created by the bootstrap transaction', () => {
    const state = initialState(scenarioOf([BEGIN, COMMIT], [BEGIN, COMMIT]), 'read-committed');
    expect(state.versions).toEqual([
      { table: 'tickets', key: 1, values: ROW, xmin: 0, xmax: null },
    ]);
    expect(state.clog).toEqual({ 0: 'committed', 1: 'in-progress', 2: 'in-progress' });
    expect(allFinished(state)).toBe(false);
    expect(canRun(state, 1)).toBe(true);
  });

  it('refuses to step a finished transaction', () => {
    const scenario = scenarioOf([BEGIN, ROLLBACK], [BEGIN, COMMIT]);
    let state = initialState(scenario, 'read-committed');
    state = step(scenario, state, 1);
    state = step(scenario, state, 1);
    expect(() => step(scenario, state, 1)).toThrow('T1 cannot run: rolled-back');
  });
});

// 13.2: "PostgreSQL's Read Uncommitted mode behaves like Read Committed", so an
// uncommitted write is invisible at every level the engine offers.
describe('no dirty reads', () => {
  it.each(['read-committed', 'repeatable-read', 'serializable'] as const)(
    'hides an uncommitted write under %s',
    (level: Level) => {
      const scenario = scenarioOf([BEGIN, ADD_ONE, COMMIT], [BEGIN, READ_SOLD, COMMIT]);
      const { end } = play(scenario, level, [1, 1, 2, 2, 1, 2]);
      expect(end.txs[2].outcomes[1]?.rows).toEqual([{ sold: 11 }]);
    },
  );
});

describe('READ COMMITTED re-evaluates WHERE after a wait', () => {
  // 13.2.1: "If so, the second updater proceeds with its operation using the updated
  // version of the row." Here capacity is 12, so after T1 sells the last one the second
  // update's WHERE no longer matches and it touches nothing.
  it('drops a row that no longer matches', () => {
    const guarded: Statement = {
      kind: 'update',
      table: 'tickets',
      where: [...ID_1, { col: 'sold', op: '<', value: { col: 'capacity' } }],
      set: { sold: { kind: 'add', n: 1 } },
    };
    const scenario = scenarioOf([BEGIN, guarded, COMMIT], [BEGIN, guarded, COMMIT]);
    const { end, tables } = play(scenario, 'read-committed', [1, 1, 2, 2, 1, 2]);
    expect(end.txs[2].outcomes[1]?.rechecks).toEqual([{ key: 1, kept: false }]);
    expect(end.txs[2].outcomes[1]?.count).toBe(0);
    expect(tables.tickets?.[0]?.sold).toBe(12);
  });

  it('reports the row it waits on while it waits', () => {
    const scenario = scenarioOf([BEGIN, ADD_ONE, COMMIT], [BEGIN, ADD_ONE, COMMIT]);
    const { result } = play(scenario, 'read-committed', [1, 1, 2, 2, 1, 2]);
    const waiting = result.frames[4] as EngineState;
    expect(waiting.txs[2].status).toBe('blocked');
    expect(waiting.txs[2].outcomes[1]).toMatchObject({
      status: 'blocked',
      waitingOn: { table: 'tickets', key: 1 },
    });
    expect(canRun(waiting, 2)).toBe(false);
  });
});

describe('a concurrent delete', () => {
  const remove: Statement = { kind: 'delete', table: 'tickets', where: ID_1 };

  it('leaves nothing for a READ COMMITTED updater to update', () => {
    const scenario = scenarioOf([BEGIN, remove, COMMIT], [BEGIN, ADD_ONE, COMMIT]);
    const { end, tables } = play(scenario, 'read-committed', [1, 1, 2, 2, 1, 2]);
    expect(end.txs[2].outcomes[1]?.count).toBe(0);
    expect(end.txs[2].outcomes[1]?.rechecks).toEqual([{ key: 1, kept: false }]);
    expect(tables.tickets).toEqual([]);
  });

  // PostgreSQL 12 and later report the delete case separately, still SQLSTATE 40001.
  it('fails a REPEATABLE READ updater with concurrent delete', () => {
    const scenario = scenarioOf([BEGIN, remove, COMMIT], [BEGIN, ADD_ONE, COMMIT]);
    const { end } = play(scenario, 'repeatable-read', [1, 1, 2, 2, 1, 2]);
    expect(end.txs[2].outcomes[1]?.error).toEqual({
      sqlstate: '40001',
      message: 'could not serialize access due to concurrent delete',
    });
  });
});

describe('a failed transaction', () => {
  it('ignores every command until it ends, then answers ROLLBACK to COMMIT', () => {
    const scenario = scenarioOf([BEGIN, ADD_ONE, COMMIT], [BEGIN, ADD_ONE, READ_SOLD, COMMIT]);
    const { end } = play(scenario, 'repeatable-read', [1, 1, 2, 2, 1, 2, 2]);
    expect(statuses(end, 2)).toEqual(['done', 'failed', 'ignored', 'done']);
    expect(errors(end, 2)).toEqual([null, '40001', '25P02', null]);
    expect(end.txs[2].outcomes[2]?.error?.message).toContain('commands ignored until end of');
    expect(end.txs[2].outcomes[3]?.rolledBack).toBe(true);
    expect(end.txs[2].status).toBe('rolled-back');
  });
});

describe('locks', () => {
  it('are released by ROLLBACK, which wakes the waiter at once', () => {
    const scenario = scenarioOf([BEGIN, ADD_ONE, ROLLBACK], [BEGIN, ADD_ONE, COMMIT]);
    const { end, tables, result } = play(scenario, 'read-committed', [1, 1, 2, 2, 1, 2]);
    expect(result.frames[5]?.last?.woke).toEqual({ tx: 2, statement: 1 });
    expect(end.txs[2].outcomes[1]?.waitedFor).toBe(1);
    expect(tables.tickets?.[0]?.sold).toBe(12);
  });

  // 13.3.3: PostgreSQL detects a deadlock after deadlock_timeout and aborts one
  // transaction with SQLSTATE 40P01. The lab aborts the one that closes the cycle.
  it('deadlock: two updates in opposite order', () => {
    const tables: TableSchema[] = [{ name: 'tickets', columns: ['id', 'sold'], key: 'id' }];
    const at = (id: number): Statement => ({
      kind: 'update',
      table: 'tickets',
      where: [{ col: 'id', op: '=', value: id }],
      set: { sold: { kind: 'add', n: 1 } },
    });
    const scenario: Scenario = {
      tables,
      rows: {
        tickets: [
          { id: 1, sold: 0 },
          { id: 2, sold: 0 },
        ],
      },
      scripts: { 1: [BEGIN, at(1), at(2), COMMIT], 2: [BEGIN, at(2), at(1), COMMIT] },
    };
    const { end } = play(scenario, 'read-committed', [1, 1, 2, 2, 1, 2]);
    const failed = ([1, 2] as TxId[]).filter((tx) => errors(end, tx).includes('40P01'));
    expect(failed).toEqual([2]);
    expect(end.txs[2].outcomes[2]?.error?.message).toBe('deadlock detected');
  });
});

describe('the application around the statements', () => {
  it('skips a statement whose guard fails and one whose variable was never read', () => {
    const guarded: Statement = { ...ADD_ONE, guard: { var: 'sold', op: '>', value: 99 } };
    const fromVar: Statement = {
      kind: 'update',
      table: 'tickets',
      where: ID_1,
      set: { sold: { kind: 'var', name: 'never', plus: 1 } },
    };
    const scenario = scenarioOf([BEGIN, READ_SOLD, guarded, COMMIT], [BEGIN, fromVar, COMMIT]);
    const { end, tables } = play(scenario, 'read-committed', [1, 1, 1, 1, 2, 2, 2]);
    expect(statuses(end, 1)[2]).toBe('skipped');
    expect(statuses(end, 2)[1]).toBe('skipped');
    expect(tables.tickets?.[0]?.sold).toBe(11);
  });

  it('forgets a bound variable when the select returned nothing', () => {
    const missing: Statement = {
      kind: 'select',
      table: 'tickets',
      where: [{ col: 'id', op: '=', value: 9 }],
      columns: ['sold'],
      bind: { name: 'sold', take: { col: 'sold' } },
    };
    const setIt: Statement = {
      kind: 'update',
      table: 'tickets',
      where: ID_1,
      set: { sold: { kind: 'var', name: 'sold', plus: 1 } },
    };
    const scenario = scenarioOf([BEGIN, READ_SOLD, missing, setIt, COMMIT], [BEGIN, COMMIT]);
    const { end } = play(scenario, 'read-committed', [1, 1, 1, 1, 1, 2, 2]);
    expect(statuses(end, 1)[3]).toBe('skipped');
  });

  it('names the value it computed, so the view can show :new_sold', () => {
    const setIt: Statement = {
      kind: 'update',
      table: 'tickets',
      where: ID_1,
      set: { sold: { kind: 'var', name: 'sold', plus: 1 } },
      bind: { name: 'changed', take: 'count' },
    };
    const readIt: Statement = { ...READ_SOLD, bind: { name: 'sold', take: { col: 'sold' } } };
    const scenario = scenarioOf([BEGIN, readIt, setIt, COMMIT], [BEGIN, COMMIT]);
    const { end } = play(scenario, 'read-committed', [1, 1, 1, 1, 2, 2]);
    expect(paramName('sold')).toBe('new_sold');
    expect(end.txs[1].outcomes[2]?.params).toEqual({ new_sold: 12 });
  });
});

describe('check constraints', () => {
  const capped: TableSchema = {
    ...TICKETS,
    checks: [
      { name: 'not_oversold', where: [{ col: 'sold', op: '<=', value: { col: 'capacity' } }] },
    ],
  };

  it('fail an UPDATE that would break them, with SQLSTATE 23514', () => {
    const scenario: Scenario = {
      tables: [capped],
      rows: { tickets: [{ id: 1, sold: 12, capacity: 12 }] },
      scripts: { 1: [BEGIN, ADD_ONE, COMMIT], 2: [BEGIN, COMMIT] },
    };
    const { end } = play(scenario, 'read-committed', [1, 1, 1, 2, 2]);
    expect(end.txs[1].outcomes[1]?.error).toEqual({
      sqlstate: '23514',
      message: 'new row for relation "tickets" violates check constraint "not_oversold"',
    });
  });

  it('fail an INSERT that would break them', () => {
    const insert: Statement = {
      kind: 'insert',
      table: 'tickets',
      values: { id: 2, sold: 5, capacity: 1 },
    };
    const scenario: Scenario = {
      tables: [capped],
      rows: { tickets: [ROW] },
      scripts: { 1: [BEGIN, insert, COMMIT], 2: [BEGIN, COMMIT] },
    };
    const { end, tables } = play(scenario, 'read-committed', [1, 1, 1, 2, 2]);
    expect(errors(end, 1)[1]).toBe('23514');
    expect(tables.tickets).toEqual([ROW]);
  });
});

describe('committedTables', () => {
  it('shows nothing an aborted transaction wrote', () => {
    const scenario = scenarioOf([BEGIN, ADD_ONE, ROLLBACK], [BEGIN, COMMIT]);
    const { end } = play(scenario, 'read-committed', [1, 1, 1, 2, 2]);
    expect(committedTables(scenario.tables, end.versions, end.clog)).toEqual({ tickets: [ROW] });
  });
});
