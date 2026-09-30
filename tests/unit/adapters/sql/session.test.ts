import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNodeSqlEngine, type NodeSqlEngine } from '@/adapters/sql/node';
import type { SqlRunReport } from '@/core/sql/report';

/*
 * The real PGlite, as the gate and the browser worker use it. Starting it runs initdb,
 * a few seconds, so one database serves the whole file: which also proves the reset.
 */

let engine: NodeSqlEngine;

beforeAll(async () => {
  engine = createNodeSqlEngine();
  await engine.run({ setup: '', sql: 'select 1' });
}, 60_000);

afterAll(async () => {
  await engine.close();
});

const SETUP = `
create table customers (id int primary key, name text not null);
create table orders (
  id int primary key,
  customer_id int references customers (id),
  total numeric(8, 2),
  shipped boolean,
  placed timestamptz default '2026-01-01 09:00+00'
);
insert into customers values (1, 'Ana'), (2, 'Ben');
insert into orders (id, customer_id, total, shipped) values (1, 1, 12.5, true), (2, 2, null, false);
`;

type Ran = Extract<SqlRunReport, { status: 'ran' }>;

async function ran(sql: string, extra: { query?: string; describe?: boolean } = {}): Promise<Ran> {
  const report = await engine.run({ setup: SETUP, sql, ...extra });
  if (report.status !== 'ran') throw new Error(`expected a run, got ${JSON.stringify(report)}`);
  return report;
}

describe('a SQL session', () => {
  it('returns every value as the text Postgres prints, and null as null', async () => {
    const report = await ran('select id, total, shipped, placed from orders order by id');
    expect(report.statements).toHaveLength(1);
    expect(report.statements[0]).toMatchObject({
      status: 'ok',
      line: 1,
      command: 'SELECT',
      result: {
        columns: ['id', 'total', 'shipped', 'placed'],
        rows: [
          ['1', '12.50', 't', '2026-01-01 09:00:00+00'],
          ['2', null, 'f', '2026-01-01 09:00:00+00'],
        ],
        rowCount: 2,
      },
    });
  });

  it('runs each statement on its own and reports each one', async () => {
    const report = await ran(
      "insert into customers values (3, 'Cy');\nupdate orders set shipped = true;\nselect count(*) from customers;",
    );
    expect(report.statements.map((s) => (s.status === 'ok' ? s.command : 'error'))).toEqual([
      'INSERT',
      'UPDATE',
      'SELECT',
    ]);
    expect(report.statements[0]).toMatchObject({ affected: 1, line: 1 });
    expect(report.statements[1]).toMatchObject({ affected: 2, line: 2 });
    expect(report.statements[2]).toMatchObject({ result: { rows: [['3']] }, line: 3 });
  });

  it('starts every run from the setup, whatever the last run did', async () => {
    await ran(
      "drop table orders; create schema extra; create table extra.t (a int); create role clerk; set timezone = 'Asia/Tokyo'; begin; delete from customers;",
    );
    const report = await ran(
      "select count(*) from customers; select current_setting('TimeZone'); select count(*) from pg_roles where rolname = 'clerk'; select count(*) from pg_namespace where nspname = 'extra'",
    );
    const values = report.statements.map((s) =>
      s.status === 'ok' ? s.result?.rows[0]?.[0] : null,
    );
    expect(values).toEqual(['2', 'UTC', '0', '0']);
  });

  it('recovers from a transaction the last run left failed', async () => {
    await ran('begin; select 1/0;');
    expect((await ran('select 1')).statements[0]?.status).toBe('ok');
  });

  it('stops at the first error with Postgres’s own message and where it points', async () => {
    const report = await ran('select 1;\nselect *\nfrom ordrs;\nselect 2;');
    expect(report.skipped).toBe(1);
    expect(report.statements[1]).toMatchObject({
      status: 'error',
      line: 2,
      error: { message: 'relation "ordrs" does not exist', code: '42P01', line: 3, column: 6 },
    });
  });

  it('passes on the detail of a constraint error', async () => {
    const report = await ran("insert into customers values (1, 'Again')");
    expect(report.statements[0]).toMatchObject({
      status: 'error',
      error: {
        message: 'duplicate key value violates unique constraint "customers_pkey"',
        detail: 'Key (id)=(1) already exists.',
        code: '23505',
      },
    });
  });

  it('describes the tables, their keys and what they reference', async () => {
    const report = await ran('', { describe: true });
    expect(report.statements).toEqual([]);
    expect(report.schema).toEqual([
      {
        name: 'customers',
        columns: [
          { name: 'id', type: 'integer', notNull: true, primaryKey: true },
          { name: 'name', type: 'text', notNull: true, primaryKey: false },
        ],
      },
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'integer', notNull: true, primaryKey: true },
          {
            name: 'customer_id',
            type: 'integer',
            notNull: false,
            primaryKey: false,
            references: 'customers',
          },
          { name: 'total', type: 'numeric(8,2)', notNull: false, primaryKey: false },
          { name: 'shipped', type: 'boolean', notNull: false, primaryKey: false },
          { name: 'placed', type: 'timestamp with time zone', notNull: false, primaryKey: false },
        ],
      },
    ]);
  });

  it('runs the check query after the SQL, and reports its error', async () => {
    const report = await ran('delete from orders where shipped', {
      query: 'select id from orders',
    });
    expect(report.query).toEqual({ result: { columns: ['id'], rows: [['2']], rowCount: 1 } });
    const broken = await ran('drop table orders', { query: 'select id from orders' });
    expect(broken.query).toMatchObject({ error: { message: 'relation "orders" does not exist' } });
  });

  it('keeps duplicate column names and caps the rows it sends', async () => {
    const report = await ran('select 1 as a, 2 as a; select generate_series(1, 600)');
    expect(report.statements[0]).toMatchObject({ result: { columns: ['a', 'a'] } });
    expect(report.statements[1]).toMatchObject({ result: { rowCount: 600, truncated: true } });
    const second = report.statements[1];
    expect(second?.status === 'ok' ? second.result?.rows : []).toHaveLength(500);
  });

  it('reports a setup that fails', async () => {
    expect(await engine.run({ setup: 'create tabel x (a int)', sql: 'select 1' })).toMatchObject({
      status: 'setup-error',
      error: { message: 'syntax error at or near "tabel"' },
    });
  });

  it('keeps enums, arrays and json as text', async () => {
    const report = await engine.run({
      setup: "create type mood as enum ('calm', 'busy');",
      sql: "select 'busy'::mood, array[1, 2], '{\"a\": 1}'::jsonb, interval '90 minutes', 1.5::float8",
    });
    expect(report).toMatchObject({
      statements: [{ result: { rows: [['busy', '{1,2}', '{"a": 1}', '01:30:00', '1.5']] } }],
    });
  });
});
