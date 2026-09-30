import { PGlite } from '@electric-sql/pglite';
import type { SqlEngine } from '@/core/ports/sql-engine';
import type { SqlRunReport, SqlRunRequest } from '@/core/sql/report';
import {
  createSqlSession,
  PGLITE_CONF,
  textParsers,
  type PgliteLike,
  type SqlSession,
} from './session';

/*
 * The SQL engine in Node, for the content gate and the unit tests: the same PGlite
 * build and the same session as the browser worker, in this process.
 *
 * No timeout: PGlite runs on this thread and nothing can interrupt it. The gate runs
 * reviewed lesson SQL, never learner input.
 */

export interface NodeSqlEngine extends SqlEngine {
  close(): Promise<void>;
}

export function createNodeSqlEngine(): NodeSqlEngine {
  let started: Promise<{ db: PGlite; session: SqlSession }> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const start = () => {
    started ??= (async () => {
      const db = await PGlite.create({ postgresqlconf: PGLITE_CONF });
      const like = db as unknown as PgliteLike;
      return { db, session: createSqlSession(like, await textParsers(like)) };
    })();
    return started;
  };

  return {
    run(request: SqlRunRequest): Promise<SqlRunReport> {
      // One database: runs take turns, as they do in the worker.
      const next = queue.then(async (): Promise<SqlRunReport> => {
        try {
          const { session } = await start();
          return await session.run(request);
        } catch (error) {
          return {
            status: 'unavailable',
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      });
      queue = next;
      return next;
    },
    async close() {
      if (!started) return;
      const { db } = await started;
      started = null;
      await db.close();
    },
  };
}
