/*
 * The SQL Web Worker: Postgres (PGlite) and one session. scripts/build-sql.ts bundles this
 * file into public/sql/<pglite version>/engine.<hash>.js, a module worker beside PGlite's
 * wasm and data files, which PGlite fetches relative to it. The page starts it only when a
 * sql step is on screen (src/adapters/sql/worker-engine.ts).
 *
 * It runs learner SQL, never learner JavaScript. Postgres here has no network, no shell
 * and no file outside its own memory, so the worker is a same-origin worker, like the type
 * checker, with a CSP of its own that adds only 'wasm-unsafe-eval' (next.config.ts).
 * Once Postgres has started, the worker's network APIs go too, so nothing it runs later
 * could reach out even through a bug in PGlite.
 */
import { PGlite } from '@electric-sql/pglite';
import { sqlWorkerRequestSchema, type SqlWorkerReply } from '@/core/sql/protocol';
import type { SqlRunReport } from '@/core/sql/report';
import { createSqlSession, PGLITE_CONF, textParsers, type PgliteLike } from './session';

interface WorkerScope {
  postMessage(message: SqlWorkerReply): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

const scope = self as unknown as WorkerScope & Record<string, unknown>;

function closeTheNetwork(): void {
  const refuse = () => {
    throw new Error('The SQL worker has no network.');
  };
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts']) {
    try {
      Object.defineProperty(scope, name, { value: refuse, writable: false, configurable: false });
    } catch {
      // A property the engine will not let go of stays; the CSP still holds.
    }
  }
}

const ready = (async () => {
  const db = await PGlite.create({ postgresqlconf: PGLITE_CONF });
  const like = db as unknown as PgliteLike;
  const session = createSqlSession(like, await textParsers(like));
  closeTheNetwork();
  return session;
})();

ready.then(
  () => scope.postMessage({ v: 1, kind: 'ready' }),
  (error: unknown) =>
    scope.postMessage({
      v: 1,
      kind: 'failed',
      reason: error instanceof Error ? error.message : 'Postgres did not start.',
    }),
);

let queue: Promise<unknown> = Promise.resolve();

scope.addEventListener('message', (event) => {
  const parsed = sqlWorkerRequestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const { id, request } = parsed.data;
  // One database: runs take turns.
  queue = queue.then(async () => {
    let report: SqlRunReport;
    try {
      report = await (await ready).run(request);
    } catch (error) {
      report = {
        status: 'unavailable',
        reason: error instanceof Error ? error.message : 'Postgres stopped.',
      };
    }
    scope.postMessage({ v: 1, kind: 'report', id, report });
  });
});
