import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { parseSqlManifest, sqlWorkerUrl } from '@/adapters/sql/assets';
import { createNodeSqlEngine } from '@/adapters/sql/node';
import { WorkerSqlEngine, type SqlWorker } from '@/adapters/sql/worker-engine';
import { SQL_LIMITS } from '@/core/sql/limits';
import { sqlWorkerRequestSchema } from '@/core/sql/protocol';

type Listener = (event: { data?: unknown }) => void;

const node = createNodeSqlEngine();

afterAll(async () => {
  await node.close();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Answers like the real worker, with the real Postgres in Node, unless told otherwise. */
class FakeWorker implements SqlWorker {
  listeners: Record<'message' | 'error', Listener[]> = { message: [], error: [] };
  terminated = false;
  posted: unknown[] = [];
  reply: 'real' | 'silent' | 'garbage' = 'real';

  constructor(private readonly boot: 'ready' | 'failed' | 'never' = 'ready') {}

  send(data: unknown): void {
    for (const listener of this.listeners.message) listener({ data });
  }

  /** A real worker's first message waits for the page's listener; so does this one's. */
  addEventListener(type: 'message' | 'error', listener: Listener): void {
    this.listeners[type].push(listener);
    if (type !== 'message') return;
    queueMicrotask(() => {
      if (this.boot === 'ready') this.send({ v: 1, kind: 'ready' });
      if (this.boot === 'failed') this.send({ v: 1, kind: 'failed', reason: 'no wasm' });
    });
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
    const { id, request } = sqlWorkerRequestSchema.parse(message);
    if (this.reply === 'silent') return;
    if (this.reply === 'garbage') {
      queueMicrotask(() => this.send({ v: 1, kind: 'report', id, report: { status: 'nope' } }));
      return;
    }
    void node.run(request).then((report) => this.send({ v: 1, kind: 'report', id, report }));
  }

  fail(): void {
    for (const listener of this.listeners.error) listener({});
  }

  terminate(): void {
    this.terminated = true;
  }
}

const SETUP = 'create table t (a int); insert into t values (1), (2);';

describe('WorkerSqlEngine', () => {
  it('runs SQL in the worker and passes the report through', async () => {
    const engine = new WorkerSqlEngine({ createWorker: () => Promise.resolve(new FakeWorker()) });
    const report = await engine.run({ setup: SETUP, sql: 'select a from t order by a' });
    expect(report).toMatchObject({
      status: 'ran',
      statements: [{ status: 'ok', result: { rows: [['1'], ['2']] } }],
    });
    expect(engine.ready).toBe(true);
  }, 60_000);

  it('starts one worker, reuses it and sends one run at a time', async () => {
    const worker = new FakeWorker();
    const create = vi.fn(() => Promise.resolve(worker));
    const engine = new WorkerSqlEngine({ createWorker: create });
    const [a, b] = await Promise.all([
      engine.run({ setup: SETUP, sql: 'select 1' }),
      engine.run({ setup: SETUP, sql: 'select 2' }),
    ]);
    expect(a.status).toBe('ran');
    expect(b.status).toBe('ran');
    expect(create).toHaveBeenCalledTimes(1);
    expect(worker.posted).toHaveLength(2);
  });

  it('refuses SQL over the size limit without starting a worker', async () => {
    const create = vi.fn(() => Promise.resolve(new FakeWorker()));
    const engine = new WorkerSqlEngine({ createWorker: create });
    const report = await engine.run({ setup: '', sql: 'x'.repeat(SQL_LIMITS.maxSourceBytes + 1) });
    expect(report).toEqual({ status: 'unavailable', reason: 'The SQL is too long to run.' });
    expect(create).not.toHaveBeenCalled();
  });

  it('is unavailable when the worker cannot be created, and tries again next time', async () => {
    const create = vi
      .fn<() => Promise<SqlWorker>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new FakeWorker());
    const engine = new WorkerSqlEngine({ createWorker: create });
    expect(await engine.run({ setup: '', sql: 'select 1' })).toEqual({
      status: 'unavailable',
      reason: 'The database did not load.',
    });
    expect((await engine.run({ setup: '', sql: 'select 1' })).status).toBe('ran');
  });

  it('is unavailable when Postgres fails to start, and drops the worker', async () => {
    const worker = new FakeWorker('failed');
    worker.reply = 'silent';
    const engine = new WorkerSqlEngine({ createWorker: () => Promise.resolve(worker) });
    expect(await engine.run({ setup: '', sql: 'select 1' })).toEqual({
      status: 'unavailable',
      reason: 'Postgres did not start: no wasm',
    });
    expect(worker.terminated).toBe(true);
  });

  it('is unavailable when the worker script fails', async () => {
    const worker = new FakeWorker('never');
    worker.reply = 'silent';
    const engine = new WorkerSqlEngine({ createWorker: () => Promise.resolve(worker) });
    const run = engine.run({ setup: '', sql: 'select 1' });
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    worker.fail();
    expect(await run).toMatchObject({ status: 'unavailable' });
  });

  it('stops a warm run past its budget, reports a timeout, and starts afresh next time', async () => {
    vi.useFakeTimers();
    const first = new FakeWorker();
    first.reply = 'silent';
    const second = new FakeWorker();
    second.reply = 'garbage';
    const create = vi
      .fn<() => Promise<SqlWorker>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const engine = new WorkerSqlEngine({ createWorker: create, runTimeoutMs: 1000 });
    const run = engine.run({ setup: '', sql: 'select pg_sleep(60)' });
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.ready).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await run).toEqual({ status: 'timeout', limitMs: 1000 });
    expect(first.terminated).toBe(true);
    expect(engine.ready).toBe(false);
    // A garbage reply cannot be matched: the budget ends that run too.
    const next = engine.run({ setup: '', sql: 'select 1' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await next).toEqual({ status: 'timeout', limitMs: 1000 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('gives a slow start its own allowance before the run budget', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker('never');
    worker.reply = 'silent';
    const engine = new WorkerSqlEngine({
      createWorker: () => Promise.resolve(worker),
      runTimeoutMs: 1000,
      bootTimeoutMs: 5000,
    });
    const run = engine.run({ setup: '', sql: 'select 1' });
    await vi.advanceTimersByTimeAsync(5500);
    expect(worker.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(await run).toEqual({
      status: 'unavailable',
      reason: 'The database took too long to start.',
    });
  });

  it('tells subscribers when Postgres is up and when the worker goes', async () => {
    const engine = new WorkerSqlEngine({ createWorker: () => Promise.resolve(new FakeWorker()) });
    const seen: boolean[] = [];
    const stop = engine.subscribe(() => seen.push(engine.ready));
    await engine.run({ setup: '', sql: 'select 1' });
    engine.dispose();
    stop();
    expect(seen).toEqual([true, false]);
  });
});

describe('the SQL manifest', () => {
  it('names a worker inside a version directory, and nothing else', () => {
    expect(parseSqlManifest({ file: '0.5.8/engine.0123456789abcdef.js', pglite: '0.5.8' })).toEqual(
      {
        file: '0.5.8/engine.0123456789abcdef.js',
        pglite: '0.5.8',
      },
    );
    for (const file of [
      '../engine.0123456789abcdef.js',
      'engine.0123456789abcdef.js',
      'https://x.test/0.5.8/engine.0123456789abcdef.js',
    ]) {
      expect(parseSqlManifest({ file, pglite: '0.5.8' })).toBeNull();
    }
    expect(parseSqlManifest(null)).toBeNull();
  });

  it('gives the worker URL, and rejects a missing or bad manifest', async () => {
    const ok = (body: unknown) => () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    await expect(
      sqlWorkerUrl(ok({ file: '0.5.8/engine.0123456789abcdef.js', pglite: '0.5.8' })),
    ).resolves.toBe('/sql/0.5.8/engine.0123456789abcdef.js');
    await expect(sqlWorkerUrl(ok({ file: 'x' }))).rejects.toThrow('not valid');
    await expect(
      sqlWorkerUrl(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    ).rejects.toThrow('not available');
  });
});
