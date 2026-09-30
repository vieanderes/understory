import { afterAll, describe, expect, it } from 'vitest';
import { checkSqlStep, noSqlGate, pgliteSqlGate } from '../../../../scripts/lib/sql-gate';
import { createNodeSqlEngine } from '@/adapters/sql/node';
import type { SqlStep } from '@/core/content/schema';
import { rawLesson } from '../../core/content/fixtures';

const lesson = rawLesson();
const engine = createNodeSqlEngine();

afterAll(async () => {
  await engine.close();
});

function step(over: Partial<SqlStep> = {}): SqlStep {
  return {
    type: 'sql',
    id: 'find-unshipped',
    concept: 'js.coercion',
    difficulty: 1,
    prompt: 'Show every order that has not shipped.',
    setup:
      "create table orders (id int primary key, customer text, shipped boolean);\ninsert into orders values (1, 'Ana', true), (2, 'Ben', false);",
    starter: 'select * from orders;',
    solution: 'select * from orders where not shipped;',
    checks: {},
    ...over,
  };
}

const messages = async (over: Partial<SqlStep>) =>
  (await checkSqlStep(engine, { lesson, step: step(over) })).map((issue) => issue.message);

describe('the sql gate', () => {
  it('passes a step whose solution runs and whose starter falls short', async () => {
    expect(await messages({})).toEqual([]);
  }, 60_000);

  it('passes a free step whose setup runs, whatever its starter does', async () => {
    expect(await messages({ checks: undefined, solution: undefined, starter: 'selct' })).toEqual([]);
  });

  it('reports a setup that fails, with Postgres’s message', async () => {
    const [message] = await messages({ setup: 'create tabel orders (id int);' });
    expect(message).toMatch(/^The setup fails: syntax error at or near "tabel"/);
  });

  it('reports a solution that fails, with its line', async () => {
    const [message] = await messages({ solution: 'select 1;\nselect * from ordrs;' });
    expect(message).toBe(
      'The solution fails on line 2: relation "ordrs" does not exist. Fix the solution.',
    );
  });

  it('reports a solution that returns nothing to compare', async () => {
    const [message] = await messages({ solution: "insert into orders values (3, 'Cy', false);" });
    expect(message).toMatch(/^The solution cannot be compared/);
  });

  it('accepts a change checked by a query afterwards', async () => {
    expect(
      await messages({
        solution: 'delete from orders where shipped;',
        checks: { query: 'select id from orders order by id' },
      }),
    ).toEqual([]);
  });

  it('reports a starter that already gives the result', async () => {
    const [message] = await messages({ starter: 'select * from orders where shipped = false;' });
    expect(message).toMatch(/^The starter already gives the solution's result/);
  });

  it('marks its issues as errors under the sql-gate rule', async () => {
    const issues = await checkSqlStep(engine, { lesson, step: step({ setup: 'nonsense' }) });
    expect(issues[0]).toMatchObject({ severity: 'error', rule: 'sql-gate', where: 'find-unshipped' });
  });

  it('starts nothing when there is nothing to check', async () => {
    expect(await pgliteSqlGate([])).toEqual([]);
    expect(await noSqlGate([{ lesson, step: step({ setup: 'nonsense' }) }])).toEqual([]);
  });
});
