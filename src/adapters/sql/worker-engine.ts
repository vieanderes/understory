import type { SqlEngine } from '@/core/ports/sql-engine';
import { SQL_LIMITS } from '@/core/sql/limits';
import { sqlWorkerReplySchema, type SqlWorkerRequest } from '@/core/sql/protocol';
import type { SqlRunReport, SqlRunRequest } from '@/core/sql/report';
import { sqlWorkerUrl } from './assets';

/** The part of a DOM `Worker` the engine uses, so tests can hand it a fake. */
export interface SqlWorker {
  postMessage(message: SqlWorkerRequest): void;
  addEventListener(type: 'message' | 'error', listener: (event: { data?: unknown }) => void): void;
  terminate(): void;
}

export interface WorkerSqlEngineOptions {
  createWorker?: () => Promise<SqlWorker>;
  /** A run on a warm database. PGlite cannot cancel a statement, so this ends the worker. */
  runTimeoutMs?: number;
  /** Fetching, compiling and starting Postgres, before the first run's own budget. */
  bootTimeoutMs?: number;
}

/** A same-origin module worker: PGlite finds its wasm beside it (scripts/build-sql.ts). */
async function createBrowserWorker(): Promise<SqlWorker> {
  const url = await sqlWorkerUrl();
  return new Worker(url, { type: 'module', name: 'sql' }) as unknown as SqlWorker;
}

interface Pending {
  id: number;
  resolve: (report: SqlRunReport) => void;
  timer: ReturnType<typeof setTimeout> | undefined;
}

const unavailable = (reason: string): SqlRunReport => ({ status: 'unavailable', reason });

/**
 * The page's side of the SQL worker. One worker, one database, one run at a time: a run
 * is posted only when the one before it has answered, so its budget measures only itself.
 * A run never rejects. A worker that cannot load, fails to start Postgres or stops
 * answering ends the run as `unavailable`; one that runs past its budget is stopped and
 * the run ends as `timeout`. Either way the next run starts a fresh worker.
 */
export class WorkerSqlEngine implements SqlEngine {
  private readonly createWorker: () => Promise<SqlWorker>;
  private readonly runTimeoutMs: number;
  private readonly bootTimeoutMs: number;
  private worker: Promise<SqlWorker> | null = null;
  /** The worker whose messages count; one dropped may still be talking. */
  private live: SqlWorker | null = null;
  private started = false;
  /** Why the last worker went, for a run that was about to use it. */
  private lastFailure = 'The database did not load.';
  private current: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private nextId = 0;
  private readonly listeners = new Set<() => void>();

  constructor(options: WorkerSqlEngineOptions = {}) {
    this.createWorker = options.createWorker ?? createBrowserWorker;
    this.runTimeoutMs = options.runTimeoutMs ?? SQL_LIMITS.runTimeoutMs;
    this.bootTimeoutMs = options.bootTimeoutMs ?? SQL_LIMITS.bootTimeoutMs;
  }

  /** True once Postgres has started in the current worker. */
  get ready(): boolean {
    return this.started;
  }

  /** Called when `ready` changes, for `useSyncExternalStore`. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  run(request: SqlRunRequest): Promise<SqlRunReport> {
    const next = this.queue.then(() => this.runNow(request));
    this.queue = next;
    return next;
  }

  dispose(): void {
    this.drop('The database was closed.');
  }

  private async runNow(request: SqlRunRequest): Promise<SqlRunReport> {
    const sizes = [request.setup, request.sql, request.query ?? ''].map((s) => s.length);
    if (sizes.some((size) => size > SQL_LIMITS.maxSourceBytes)) {
      return unavailable('The SQL is too long to run.');
    }
    let worker: SqlWorker;
    try {
      worker = await this.start();
    } catch {
      this.worker = null;
      return unavailable('The database did not load.');
    }
    // The worker may have failed between starting and this run.
    if (worker !== this.live) return unavailable(this.lastFailure);
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<SqlRunReport>((resolve) => {
      this.current = { id, resolve, timer: undefined };
      this.arm();
      worker.postMessage({ v: 1, id, request });
    });
  }

  /** The budget of the run in flight: the boot allowance until Postgres is up, then its own. */
  private arm(): void {
    const pending = this.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.timer = this.started
      ? setTimeout(() => this.timedOut(), this.runTimeoutMs)
      : setTimeout(
          () => this.drop('The database took too long to start.'),
          this.bootTimeoutMs + this.runTimeoutMs,
        );
  }

  private start(): Promise<SqlWorker> {
    this.worker ??= this.createWorker().then((worker) => {
      this.live = worker;
      worker.addEventListener('message', (event) => this.receive(worker, event.data));
      // A worker whose script failed to load or threw at the top level is of no more use.
      worker.addEventListener('error', () => {
        if (worker === this.live) this.drop('The database did not load.');
      });
      return worker;
    });
    return this.worker;
  }

  private receive(worker: SqlWorker, data: unknown): void {
    // A message from a worker already dropped is about a run that has ended.
    if (worker !== this.live) return;
    const reply = sqlWorkerReplySchema.safeParse(data);
    // A reply that does not parse cannot be matched; the run's timer ends it.
    if (!reply.success) return;
    const message = reply.data;
    if (message.kind === 'ready') {
      this.setStarted(true);
      this.arm();
    } else if (message.kind === 'failed') {
      this.drop(`Postgres did not start: ${message.reason}`);
    } else if (this.current?.id === message.id) {
      this.finish(message.report);
    }
  }

  private finish(report: SqlRunReport): void {
    const pending = this.current;
    if (!pending) return;
    this.current = null;
    clearTimeout(pending.timer);
    pending.resolve(report);
  }

  private timedOut(): void {
    this.stopWorker();
    this.finish({ status: 'timeout', limitMs: this.runTimeoutMs });
  }

  /** Ends the run in flight as unavailable and drops the worker. */
  private drop(reason: string): void {
    this.lastFailure = reason;
    this.stopWorker();
    this.finish(unavailable(reason));
  }

  private stopWorker(): void {
    const worker = this.worker;
    this.worker = null;
    this.live = null;
    this.setStarted(false);
    void worker?.then((w) => w.terminate()).catch(() => undefined);
  }

  private setStarted(value: boolean): void {
    if (this.started === value) return;
    this.started = value;
    for (const listener of this.listeners) listener();
  }
}
