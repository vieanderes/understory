import { describe, expect, it } from 'vitest';
import { validateScenario } from '@/core/labs/isolation-anomaly-stepper/engine';
import {
  DEFAULT_SCENARIO_ID,
  SCENARIOS,
  SCENARIO_IDS,
  buildScenario,
  scenarioDef,
  variantOf,
} from '@/core/labs/isolation-anomaly-stepper/scenarios';
import { LEVELS, type TxId } from '@/core/labs/isolation-anomaly-stepper/types';
import { errors, finish, statuses } from './helpers';

/*
 * Every expectation here is PostgreSQL's documented behaviour, chapter 13 "Concurrency
 * Control". A live PostgreSQL 17 server was stepped through the same interleavings with
 * two psql sessions; the numbers below are what it printed.
 */

describe('the shipped scenarios', () => {
  it('lists five, with the balance scenario first', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(SCENARIO_IDS);
    expect(DEFAULT_SCENARIO_ID).toBe('non-repeatable-read');
  });

  it.each(SCENARIO_IDS)('%s is well formed at every level', (id) => {
    const def = scenarioDef(id);
    expect(def).toBeDefined();
    for (const variant of (def as NonNullable<typeof def>).variants) {
      const built = buildScenario(id, variant.id);
      expect(() => validateScenario(built.scenario)).not.toThrow();
      for (const tx of [1, 2] as TxId[]) {
        expect(built.lines[tx].length).toBe(built.scenario.scripts[tx].length);
        expect(built.lines[tx].every((l) => l.sql.length > 0)).toBe(true);
      }
      expect(built.prompt.startsWith('Before you step:')).toBe(true);
      for (const level of LEVELS) {
        const { end, result } = finish(id, level, variant.id);
        expect(result.frames.length).toBe(result.schedule.length + 1);
        expect(end.txs[1].status).toMatch(/committed|rolled-back/);
        expect(end.txs[2].status).toMatch(/committed|rolled-back/);
      }
    }
  });

  it('falls back to the default scenario and the first variant', () => {
    expect(buildScenario('nope').id).toBe(DEFAULT_SCENARIO_ID);
    expect(buildScenario('lost-update', 'nope').variant).toBe('read-modify-write');
    expect(variantOf(scenarioDef('lost-update') as never, 'atomic')).toBe('atomic');
  });
});

describe('non-repeatable read', () => {
  it('shows a different balance the second time under READ COMMITTED', () => {
    const { end, tables, verdict } = finish('non-repeatable-read', 'read-committed');
    expect(end.txs[1].outcomes[1]?.rows).toEqual([{ balance: 100 }]);
    expect(end.txs[1].outcomes[2]?.rows).toEqual([{ balance: 60 }]);
    expect(tables.accounts?.[0]?.balance).toBe(60);
    expect(verdict.serialisable).toBe(false);
    expect(verdict.anomaly).toBe('non-repeatable-read');
  });

  // 13.2.2: a repeatable read query "sees a snapshot as of the start of the first
  // non-transaction-control statement in the transaction".
  it.each(['repeatable-read', 'serializable'] as const)('reads 100 twice under %s', (level) => {
    const { end, verdict } = finish('non-repeatable-read', level);
    expect(end.txs[1].outcomes[1]?.rows).toEqual([{ balance: 100 }]);
    expect(end.txs[1].outcomes[2]?.rows).toEqual([{ balance: 100 }]);
    expect(verdict.serialisable).toBe(true);
    expect(verdict.serial.find((s) => s.same)?.order).toEqual([1, 2]);
  });
});

describe('phantom read', () => {
  it('counts 2 then 3 under READ COMMITTED', () => {
    const { end, verdict } = finish('phantom-read', 'read-committed');
    expect(end.txs[1].outcomes.map((o) => o.count)).toEqual([undefined, 2, 3, undefined]);
    expect(verdict.anomaly).toBe('phantom-read');
  });

  // 13.2.2: "PostgreSQL's Repeatable Read implementation does not allow phantom reads."
  it.each(['repeatable-read', 'serializable'] as const)('counts 2 twice under %s', (level) => {
    const { end, tables, verdict } = finish('phantom-read', level);
    expect(end.txs[1].outcomes.map((o) => o.count)).toEqual([undefined, 2, 2, undefined]);
    expect(tables.bookings?.length).toBe(3);
    expect(verdict.serialisable).toBe(true);
  });
});

describe('lost update, read-modify-write in the application', () => {
  it('loses one sale under READ COMMITTED', () => {
    const { end, tables, verdict } = finish('lost-update', 'read-committed', 'read-modify-write');
    expect(tables.products?.[0]?.stock).toBe(4);
    expect(end.txs[1].outcomes[2]?.params).toEqual({ new_stock: 4 });
    expect(verdict.committed).toEqual([1, 2]);
    expect(verdict.anomaly).toBe('lost-update');
    expect(verdict.serial.every((s) => s.tables.products?.[0]?.stock === 3)).toBe(true);
  });

  // 13.2.2: "could not serialize access due to concurrent update", SQLSTATE 40001.
  it.each(['repeatable-read', 'serializable'] as const)('fails T1 with 40001 under %s', (level) => {
    const { end, tables, verdict } = finish('lost-update', level, 'read-modify-write');
    expect(errors(end, 1)[2]).toBe('40001');
    expect(end.txs[1].outcomes[2]?.error?.message).toBe(
      'could not serialize access due to concurrent update',
    );
    expect(end.txs[1].status).toBe('rolled-back');
    expect(tables.products?.[0]?.stock).toBe(4);
    expect(verdict.committed).toEqual([2]);
    expect(verdict.serialisable).toBe(true);
  });
});

describe('lost update, fixed with an atomic update', () => {
  // 13.2.1: the second updater "will attempt to apply its operation to the updated
  // version of the row. The search condition of the command is re-evaluated".
  it('waits, re-reads and counts both sales under READ COMMITTED', () => {
    const { end, tables, verdict } = finish('lost-update', 'read-committed', 'atomic');
    expect(statuses(end, 2)).toEqual(['done', 'done', 'done']);
    expect(end.txs[2].outcomes[1]?.waitedFor).toBe(1);
    expect(end.txs[2].outcomes[1]?.rechecks).toEqual([{ key: 1, kept: true }]);
    expect(tables.products?.[0]?.stock).toBe(3);
    expect(verdict.serialisable).toBe(true);
    expect(verdict.anomaly).toBeNull();
  });

  it.each(['repeatable-read', 'serializable'] as const)('fails T2 with 40001 under %s', (level) => {
    const { end, tables } = finish('lost-update', level, 'atomic');
    expect(errors(end, 2)[1]).toBe('40001');
    expect(tables.products?.[0]?.stock).toBe(4);
  });
});

describe('lost update, fixed with SELECT FOR UPDATE', () => {
  it('blocks the second reader until the first commits under READ COMMITTED', () => {
    const { end, tables, verdict } = finish('lost-update', 'read-committed', 'for-update');
    expect(end.txs[2].outcomes[1]?.rows).toEqual([{ stock: 4 }]);
    expect(end.txs[2].outcomes[1]?.waitedFor).toBe(1);
    expect(tables.products?.[0]?.stock).toBe(3);
    expect(verdict.serialisable).toBe(true);
  });

  // 13.3.2: "an error will be thrown if a row to be locked has changed since the
  // transaction started" under REPEATABLE READ or SERIALIZABLE.
  it.each(['repeatable-read', 'serializable'] as const)('fails the lock under %s', (level) => {
    const { end, tables } = finish('lost-update', level, 'for-update');
    expect(errors(end, 2)[1]).toBe('40001');
    expect(tables.products?.[0]?.stock).toBe(4);
  });
});

describe('write skew', () => {
  // Berenson et al. 1995, A5B: the two transactions write different rows, so
  // first-committer-wins never fires and snapshot isolation allows it.
  it.each(['read-committed', 'repeatable-read'] as const)(
    'leaves nobody on call under %s',
    (level) => {
      const { end, tables, verdict } = finish('write-skew', level);
      expect(end.txs[1].status).toBe('committed');
      expect(end.txs[2].status).toBe('committed');
      expect(tables.doctors?.every((r) => r.on_call === false)).toBe(true);
      expect(verdict.invariant).toEqual({
        label: 'at least one doctor on call',
        holds: false,
        actual: 0,
      });
      expect(verdict.anomaly).toBe('write-skew');
    },
  );

  // 13.2.3: SERIALIZABLE "could not serialize access due to read/write dependencies
  // among transactions".
  it('fails the second committer under SERIALIZABLE', () => {
    const { end, tables, verdict } = finish('write-skew', 'serializable');
    expect(end.txs[1].status).toBe('committed');
    expect(end.txs[2].status).toBe('rolled-back');
    expect(errors(end, 2)[3]).toBe('40001');
    expect(end.txs[2].outcomes[3]?.error?.message).toBe(
      'could not serialize access due to read/write dependencies among transactions',
    );
    expect(tables.doctors).toEqual([
      { name: 'alice', on_call: false },
      { name: 'bob', on_call: true },
    ]);
    expect(verdict.invariant?.holds).toBe(true);
    expect(verdict.serialisable).toBe(true);
  });
});

describe('check then insert', () => {
  it.each(['read-committed', 'repeatable-read'] as const)(
    'takes a fourth booking under %s',
    (lvl) => {
      const { tables, verdict } = finish('check-then-insert', lvl);
      expect(tables.bookings?.length).toBe(4);
      expect(verdict.invariant?.holds).toBe(false);
      expect(verdict.serialisable).toBe(false);
    },
  );

  it('fails the second insert under SERIALIZABLE', () => {
    const { end, tables, verdict } = finish('check-then-insert', 'serializable');
    expect(errors(end, 2)[2]).toBe('40001');
    expect(statuses(end, 2)).toEqual(['done', 'done', 'failed', 'done']);
    expect(tables.bookings?.length).toBe(3);
    expect(verdict.invariant?.holds).toBe(true);
    expect(verdict.serialisable).toBe(true);
  });
});
