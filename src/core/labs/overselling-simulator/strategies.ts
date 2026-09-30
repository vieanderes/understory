import type { HoldsStrategy, ReserveStrategy, Strategy } from './types';

export interface SketchLine {
  /** Names the routine a line belongs to, where a sketch shows more than one. */
  readonly routine?: string;
  readonly code: string;
}

export interface StrategyInfo {
  readonly id: Strategy;
  /** Short name for the switch. */
  readonly label: string;
  readonly title: string;
  /** Whether `sold <= capacity` survives every interleaving. */
  readonly verdict: 'breaks' | 'holds';
  /** One sentence: why, and what it costs. */
  readonly summary: string;
  readonly sketch: readonly SketchLine[];
}

export const RESERVE_STRATEGIES: readonly ReserveStrategy[] = [
  'check-then-act',
  'transaction',
  'atomic-update',
  'pessimistic-lock',
  'optimistic',
  'constraint',
  'serializable',
];

export const HOLDS_STRATEGIES: readonly HoldsStrategy[] = [
  'holds-read-then-write',
  'holds-guarded',
];

const RESERVE_HOLD =
  'UPDATE events SET held = held + :qty WHERE id = :id AND sold + held + :qty <= capacity;';

export const STRATEGIES: Readonly<Record<Strategy, StrategyInfo>> = {
  'check-then-act': {
    id: 'check-then-act',
    label: 'Check-then-act',
    title: 'Check-then-act, no protection',
    verdict: 'breaks',
    summary:
      'The check and the write are separate statements. Another buyer can write between them, so the check decides on a stale value.',
    sketch: [
      { code: 'SELECT sold, capacity FROM events WHERE id = :id;' },
      { code: "if (sold + qty > capacity) return 'sold out';" },
      { code: 'UPDATE events SET sold = sold + :qty WHERE id = :id;' },
    ],
  },
  transaction: {
    id: 'transaction',
    label: 'Transaction',
    title: 'One transaction at READ COMMITTED',
    verdict: 'breaks',
    summary:
      'A transaction makes the statements atomic, not serial. Both buyers still read the same committed count. The second write waits for the row lock, then goes through unchecked.',
    sketch: [
      { code: 'BEGIN; -- READ COMMITTED, the Postgres default' },
      { code: 'SELECT sold, capacity FROM events WHERE id = :id;' },
      { code: "if (sold + qty > capacity) return rollback('sold out');" },
      { code: 'UPDATE events SET sold = sold + :qty WHERE id = :id;' },
      { code: 'COMMIT;' },
    ],
  },
  'atomic-update': {
    id: 'atomic-update',
    label: 'Atomic update',
    title: 'Atomic conditional update',
    verdict: 'holds',
    summary:
      'The check lives inside the write, so there is no gap to interleave. The only lock is the row lock inside the one statement. The application must read the row count.',
    sketch: [
      { code: 'UPDATE events SET sold = sold + :qty' },
      { code: ' WHERE id = :id AND sold + :qty <= capacity;' },
      { code: "if (rowCount === 0) return 'sold out';" },
    ],
  },
  'pessimistic-lock': {
    id: 'pessimistic-lock',
    label: 'FOR UPDATE',
    title: 'Pessimistic lock',
    verdict: 'holds',
    summary:
      'The read takes the row lock, so the check and the write happen with nobody else in the row. Every other buyer queues behind it: the cost is waiting.',
    sketch: [
      { code: 'BEGIN;' },
      { code: 'SELECT sold, capacity FROM events WHERE id = :id FOR UPDATE;' },
      { code: "if (sold + qty > capacity) return rollback('sold out');" },
      { code: 'UPDATE events SET sold = sold + :qty WHERE id = :id;' },
      { code: 'COMMIT;' },
    ],
  },
  optimistic: {
    id: 'optimistic',
    label: 'Version',
    title: 'Optimistic concurrency',
    verdict: 'holds',
    summary:
      'Nobody waits. The write succeeds only if the version is the one that was read. A buyer who loses starts again, so the cost under contention is wasted work.',
    sketch: [
      { code: 'SELECT sold, capacity, version FROM events WHERE id = :id;' },
      { code: "if (sold + qty > capacity) return 'sold out';" },
      { code: 'UPDATE events SET sold = :sold + :qty, version = version + 1' },
      { code: ' WHERE id = :id AND version = :seen;' },
      { code: 'if (rowCount === 0) retry();' },
    ],
  },
  constraint: {
    id: 'constraint',
    label: 'CHECK',
    title: 'Constraint as the last line of defence',
    verdict: 'holds',
    summary:
      'The same racy code as check-then-act, but the schema refuses the row that would oversell. The cost is an error the application must catch and turn into "sold out".',
    sketch: [
      { code: 'ALTER TABLE events ADD CONSTRAINT sold_within_capacity CHECK (sold <= capacity);' },
      { code: 'SELECT sold, capacity FROM events WHERE id = :id;' },
      { code: "if (sold + qty > capacity) return 'sold out';" },
      { code: 'UPDATE events SET sold = sold + :qty WHERE id = :id; -- may raise 23514' },
    ],
  },
  serializable: {
    id: 'serializable',
    label: 'SERIALIZABLE',
    title: 'SERIALIZABLE isolation',
    verdict: 'holds',
    summary:
      'The database lets the transactions overlap and aborts one that could not have run alone: SQLSTATE 40001. The cost is an aborted transaction the application must run again.',
    sketch: [
      { code: 'BEGIN ISOLATION LEVEL SERIALIZABLE;' },
      { code: 'SELECT sold, capacity FROM events WHERE id = :id;' },
      { code: "if (sold + qty > capacity) return rollback('sold out');" },
      { code: 'UPDATE events SET sold = sold + :qty WHERE id = :id; -- may raise 40001' },
      { code: 'COMMIT;' },
      { code: 'catch (40001) { retry(); }' },
    ],
  },
  'holds-read-then-write': {
    id: 'holds-read-then-write',
    label: 'Read, then write',
    title: 'Hold transitions: read, then write',
    verdict: 'breaks',
    summary:
      'The sweep and the payment webhook each read the hold, decide, then write. Both can see "active", so the hold is expired and confirmed, and its ticket is sold twice.',
    sketch: [
      { routine: 'confirm', code: 'SELECT status FROM holds WHERE id = :hold;' },
      { routine: 'confirm', code: "if (status !== 'active') return refund();" },
      {
        routine: 'confirm',
        code: "UPDATE holds SET status = 'confirmed' WHERE id = :hold; UPDATE events SET sold = sold + :qty, held = held - :qty;",
      },
      {
        routine: 'sweep',
        code: "SELECT id, qty FROM holds WHERE status = 'active' AND expires_at <= now();",
      },
      {
        routine: 'sweep',
        code: "UPDATE holds SET status = 'expired' WHERE id = :hold; UPDATE events SET held = held - :qty;",
      },
      { routine: 'reserve', code: RESERVE_HOLD },
    ],
  },
  'holds-guarded': {
    id: 'holds-guarded',
    label: 'Guarded transition',
    title: 'Hold transitions: guarded by status',
    verdict: 'holds',
    summary:
      'Each transition is one UPDATE that names the status it expects. The row lock lets exactly one of sweep and payment win. The cost: a buyer who paid late is refunded.',
    sketch: [
      {
        routine: 'confirm',
        code: "BEGIN; UPDATE holds SET status = 'confirmed' WHERE id = :hold AND status = 'active';",
      },
      {
        routine: 'confirm',
        code: 'if (rowCount === 1) UPDATE events SET sold = sold + :qty, held = held - :qty; else refund(); COMMIT;',
      },
      {
        routine: 'sweep',
        code: "BEGIN; UPDATE holds SET status = 'expired' WHERE status = 'active' AND expires_at <= now();",
      },
      {
        routine: 'sweep',
        code: 'if (rowCount === 1) UPDATE events SET held = held - :qty; COMMIT;',
      },
      { routine: 'reserve', code: RESERVE_HOLD },
    ],
  },
};

export function isHoldsStrategy(strategy: Strategy): strategy is HoldsStrategy {
  return strategy === 'holds-read-then-write' || strategy === 'holds-guarded';
}
