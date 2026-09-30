import type { Predicate, Scenario, Statement, TxId, Value } from './types';

/*
 * Five interleavings in plain settings, from the plain case to the one that surprises
 * experienced engineers.
 *
 * Every expected result is pinned by tests/unit/core/labs/isolation-anomaly-stepper, and
 * the rules behind them come from PostgreSQL's documentation chapter 13 "Concurrency
 * Control" (13.2 Transaction Isolation, 13.3 Explicit Locking). The anomaly names are
 * those of Berenson, Bernstein, Gray, Melton, O'Neil and O'Neil, "A Critique of ANSI SQL
 * Isolation Levels", SIGMOD 1995.
 */

export const SCENARIO_IDS = [
  'non-repeatable-read',
  'phantom-read',
  'lost-update',
  'write-skew',
  'check-then-insert',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const DEFAULT_SCENARIO_ID: ScenarioId = 'non-repeatable-read';

/** One SQL statement as the learner reads it, with the statement the engine runs. */
export interface ScriptLine {
  readonly sql: string;
  /** What the application does around the statement, when that is the point. */
  readonly note?: string;
  readonly stmt: Statement;
}

export interface Variant {
  readonly id: string;
  readonly label: string;
}

export interface Built {
  readonly id: ScenarioId;
  readonly variant: string;
  readonly title: string;
  /** One line shown before the first step, because predicting first is what teaches. */
  readonly prompt: string;
  readonly story: string;
  readonly actors: Readonly<Record<TxId, string>>;
  readonly lines: Readonly<Record<TxId, readonly ScriptLine[]>>;
  readonly scenario: Scenario;
  /** The preset interleaving: the order that shows the scenario's point. */
  readonly schedule: readonly TxId[];
}

export interface ScenarioDef {
  readonly id: ScenarioId;
  readonly title: string;
  readonly story: string;
  readonly variants: readonly Variant[];
  readonly build: (variant: string) => Omit<Built, 'id' | 'variant' | 'title' | 'story'>;
}

const ACCOUNTS = { name: 'accounts', columns: ['id', 'owner', 'balance'], key: 'id' } as const;

const BOOKINGS = { name: 'bookings', columns: ['id', 'room_id', 'guest'], key: 'id' } as const;

const PRODUCTS = { name: 'products', columns: ['id', 'name', 'stock'], key: 'id' } as const;

const DOCTORS = { name: 'doctors', columns: ['name', 'on_call'], key: 'name' } as const;

const KETTLE = { id: 1, name: 'kettle', stock: 5 };

const TWO_BOOKINGS = [
  { id: 1, room_id: 1, guest: 'kim' },
  { id: 2, room_id: 1, guest: 'lee' },
];

const ID_1: Predicate = [{ col: 'id', op: '=', value: 1 }];
const ROOM_1: Predicate = [{ col: 'room_id', op: '=', value: 1 }];
const ON_CALL: Predicate = [{ col: 'on_call', op: '=', value: true }];

const BEGIN: ScriptLine = { sql: 'BEGIN;', stmt: { kind: 'begin' } };
const COMMIT: ScriptLine = { sql: 'COMMIT;', stmt: { kind: 'commit' } };

const NO_VARIANT: readonly Variant[] = [{ id: 'default', label: 'Default' }];

function nonRepeatableRead(): ReturnType<ScenarioDef['build']> {
  const read: ScriptLine = {
    sql: 'SELECT balance FROM accounts WHERE id = 1;',
    stmt: { kind: 'select', table: 'accounts', where: ID_1, columns: ['balance'] },
  };
  return {
    prompt:
      'Before you step: T1 reads the balance twice, T2 pays by card in between. Same balance twice?',
    actors: { 1: 'Statement', 2: 'Card payment' },
    lines: {
      1: [BEGIN, read, read, COMMIT],
      2: [
        BEGIN,
        {
          sql: 'UPDATE accounts SET balance = 60 WHERE id = 1;',
          stmt: {
            kind: 'update',
            table: 'accounts',
            where: ID_1,
            set: { balance: { kind: 'const', value: 60 } },
          },
        },
        COMMIT,
      ],
    },
    scenario: {
      tables: [ACCOUNTS],
      rows: { accounts: [{ id: 1, owner: 'ana', balance: 100 }] },
      scripts: { 1: [], 2: [] },
    },
    // T1 reads, T2 pays and commits, T1 reads again.
    schedule: [1, 1, 2, 2, 2, 1, 1],
  };
}

function phantomRead(): ReturnType<ScenarioDef['build']> {
  const count: ScriptLine = {
    sql: 'SELECT count(*) FROM bookings WHERE room_id = 1;',
    stmt: { kind: 'select', table: 'bookings', where: ROOM_1, columns: 'count' },
  };
  return {
    prompt: 'Before you step: T1 counts the bookings twice, T2 adds one in between. Same count?',
    actors: { 1: 'Daily report', 2: 'Front desk' },
    lines: {
      1: [BEGIN, count, count, COMMIT],
      2: [
        BEGIN,
        {
          sql: "INSERT INTO bookings (id, room_id, guest) VALUES (3, 1, 'noor');",
          stmt: {
            kind: 'insert',
            table: 'bookings',
            values: { id: 3, room_id: 1, guest: 'noor' },
          },
        },
        COMMIT,
      ],
    },
    scenario: {
      tables: [BOOKINGS],
      rows: { bookings: TWO_BOOKINGS },
      scripts: { 1: [], 2: [] },
    },
    schedule: [1, 1, 2, 2, 2, 1, 1],
  };
}

export const LOST_UPDATE_VARIANTS: readonly Variant[] = [
  { id: 'read-modify-write', label: 'Read, subtract, write' },
  { id: 'atomic', label: 'stock = stock - 1' },
  { id: 'for-update', label: 'FOR UPDATE' },
];

function lostUpdate(variant: string): ReturnType<ScenarioDef['build']> {
  const readModifyWrite = (): readonly ScriptLine[] => [
    BEGIN,
    {
      sql: 'SELECT stock FROM products WHERE id = 1;',
      note: 'The application keeps stock.',
      stmt: {
        kind: 'select',
        table: 'products',
        where: ID_1,
        columns: ['stock'],
        bind: { name: 'stock', take: { col: 'stock' } },
      },
    },
    {
      sql: 'UPDATE products SET stock = :stock - 1 WHERE id = 1;',
      note: 'The new value was computed outside the database.',
      stmt: {
        kind: 'update',
        table: 'products',
        where: ID_1,
        set: { stock: { kind: 'var', name: 'stock', plus: -1 } },
      },
    },
    COMMIT,
  ];
  // 13.2.1: a blocked UPDATE re-evaluates its WHERE against the newest committed version,
  // so `stock > 0` is checked again after the wait, by the database.
  const atomic = (): readonly ScriptLine[] => [
    BEGIN,
    {
      sql: 'UPDATE products SET stock = stock - 1\n  WHERE id = 1 AND stock > 0;',
      note: 'The database reads and writes in one statement.',
      stmt: {
        kind: 'update',
        table: 'products',
        where: [...ID_1, { col: 'stock', op: '>', value: 0 }],
        set: { stock: { kind: 'add', n: -1 } },
      },
    },
    COMMIT,
  ];
  // 13.3.2: FOR UPDATE "prevents them from being locked, modified or deleted by other
  // transactions until the current transaction ends".
  const forUpdate = (): readonly ScriptLine[] => [
    BEGIN,
    {
      sql: 'SELECT stock FROM products WHERE id = 1 FOR UPDATE;',
      note: 'The row is locked while the application thinks.',
      stmt: {
        kind: 'select',
        table: 'products',
        where: ID_1,
        columns: ['stock'],
        forUpdate: true,
        bind: { name: 'stock', take: { col: 'stock' } },
      },
    },
    {
      sql: 'UPDATE products SET stock = :stock - 1 WHERE id = 1;',
      stmt: {
        kind: 'update',
        table: 'products',
        where: ID_1,
        set: { stock: { kind: 'var', name: 'stock', plus: -1 } },
      },
    },
    COMMIT,
  ];
  const script =
    variant === 'atomic' ? atomic() : variant === 'for-update' ? forUpdate() : readModifyWrite();
  const schedule: Record<string, readonly TxId[]> = {
    // Both read 5, T2 writes 4 and commits, T1 writes 4 over it.
    'read-modify-write': [1, 1, 2, 2, 2, 2, 1, 1],
    // T2 waits on T1's row lock, then subtracts one from the version T1 left.
    atomic: [1, 1, 2, 2, 1, 2],
    // T2 waits at the lock, not at the write, so it reads what T1 left.
    'for-update': [1, 1, 2, 2, 1, 1, 2, 2],
  };
  return {
    prompt:
      'Before you step: both sessions sell one kettle from stock = 5. What is stock at the end?',
    actors: { 1: 'Website', 2: 'Shop till' },
    lines: { 1: script, 2: script },
    scenario: {
      tables: [PRODUCTS],
      rows: { products: [KETTLE] },
      scripts: { 1: [], 2: [] },
    },
    schedule: schedule[variant] ?? (schedule['read-modify-write'] as readonly TxId[]),
  };
}

function writeSkew(): ReturnType<ScenarioDef['build']> {
  const count: ScriptLine = {
    sql: 'SELECT count(*) FROM doctors WHERE on_call;',
    note: 'The application goes on only when two are on call.',
    stmt: {
      kind: 'select',
      table: 'doctors',
      where: ON_CALL,
      columns: 'count',
      bind: { name: 'on_call', take: 'count' },
    },
  };
  const goOff = (doctor: Value): ScriptLine => ({
    sql: `UPDATE doctors SET on_call = false WHERE name = '${String(doctor)}';`,
    stmt: {
      kind: 'update',
      table: 'doctors',
      where: [{ col: 'name', op: '=', value: doctor }],
      set: { on_call: { kind: 'const', value: false } },
      guard: { var: 'on_call', op: '>=', value: 2 },
    },
  });
  return {
    prompt:
      'Before you step: both doctors check that two are on call, then both go off. Who is left?',
    actors: { 1: 'Alice', 2: 'Bob' },
    lines: {
      1: [BEGIN, count, goOff('alice'), COMMIT],
      2: [BEGIN, count, goOff('bob'), COMMIT],
    },
    scenario: {
      tables: [DOCTORS],
      rows: {
        doctors: [
          { name: 'alice', on_call: true },
          { name: 'bob', on_call: true },
        ],
      },
      scripts: { 1: [], 2: [] },
      invariant: {
        label: 'at least one doctor on call',
        table: 'doctors',
        where: ON_CALL,
        op: '>=',
        value: 1,
      },
    },
    // Both read, both write, both commit. The writes never touch the same row.
    schedule: [1, 1, 2, 2, 1, 2, 1, 2],
  };
}

function checkThenInsert(): ReturnType<ScenarioDef['build']> {
  const count: ScriptLine = {
    sql: 'SELECT count(*) FROM bookings WHERE room_id = 1;',
    note: 'The application inserts only when the count is under 3.',
    stmt: {
      kind: 'select',
      table: 'bookings',
      where: ROOM_1,
      columns: 'count',
      bind: { name: 'taken', take: 'count' },
    },
  };
  const insert = (id: number, guest: string): ScriptLine => ({
    sql: `INSERT INTO bookings (id, room_id, guest) VALUES (${id}, 1, '${guest}');`,
    stmt: {
      kind: 'insert',
      table: 'bookings',
      values: { id, room_id: 1, guest },
      guard: { var: 'taken', op: '<', value: 3 },
    },
  });
  return {
    prompt:
      'Before you step: room for three, two booked. Both sessions check, then insert. How many bookings?',
    actors: { 1: 'Website', 2: 'Front desk' },
    lines: {
      1: [BEGIN, count, insert(3, 'noor'), COMMIT],
      2: [BEGIN, count, insert(4, 'sam'), COMMIT],
    },
    scenario: {
      tables: [BOOKINGS],
      rows: { bookings: TWO_BOOKINGS },
      scripts: { 1: [], 2: [] },
      invariant: {
        label: 'at most three bookings for room 1',
        table: 'bookings',
        where: ROOM_1,
        op: '<=',
        value: 3,
      },
    },
    schedule: [1, 1, 2, 2, 1, 1, 2, 2],
  };
}

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'non-repeatable-read',
    title: 'The balance moved',
    story: 'A card payment lands while a statement reads the account balance.',
    variants: NO_VARIANT,
    build: nonRepeatableRead,
  },
  {
    id: 'phantom-read',
    title: 'A row appears',
    story: 'A report counts the bookings for room 1 twice while the front desk adds one.',
    variants: NO_VARIANT,
    build: phantomRead,
  },
  {
    id: 'lost-update',
    title: 'Two sales, one stock count',
    story: 'Two sessions each sell one kettle and each write the stock count back.',
    variants: LOST_UPDATE_VARIANTS,
    build: lostUpdate,
  },
  {
    id: 'write-skew',
    title: 'Both doctors go off call',
    story: 'Two doctors each check that someone is on call, then each goes off call.',
    variants: NO_VARIANT,
    build: writeSkew,
  },
  {
    id: 'check-then-insert',
    title: 'Check, then insert',
    story: 'Room 1 takes three bookings and has two. Two sessions count, then insert.',
    variants: NO_VARIANT,
    build: checkThenInsert,
  },
];

export function scenarioDef(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** The variant to use when none was asked for, or the one asked for is not offered. */
export function variantOf(def: ScenarioDef, wanted: string | undefined): string {
  const found = def.variants.find((v) => v.id === wanted);
  return found?.id ?? (def.variants[0] as Variant).id;
}

/**
 * Builds a scenario with its SQL text. The statement lists and the engine's scripts are
 * the same data, so a line can never drift from the statement it claims to show.
 */
export function buildScenario(id: string, variant?: string): Built {
  const def = scenarioDef(id) ?? (scenarioDef(DEFAULT_SCENARIO_ID) as ScenarioDef);
  const chosen = variantOf(def, variant);
  const parts = def.build(chosen);
  return {
    id: def.id,
    variant: chosen,
    title: def.title,
    story: def.story,
    ...parts,
    scenario: {
      ...parts.scenario,
      scripts: {
        1: parts.lines[1].map((l) => l.stmt),
        2: parts.lines[2].map((l) => l.stmt),
      },
    },
  };
}
