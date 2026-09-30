import { WorkerSqlEngine } from '@/adapters/sql/worker-engine';

/*
 * One SQL worker per page, shared by every sql step on it. Starting Postgres takes a few
 * seconds, so the worker outlives a step: the next sql step finds it warm. It is closed a
 * while after the last step lets go, because it holds a hundred megabytes or more of
 * memory a phone would rather have back.
 *
 * Getting the engine starts nothing: the worker starts on the first run.
 */

const IDLE_MS = 60_000;

interface Shared {
  engine: WorkerSqlEngine;
  users: number;
  idle: ReturnType<typeof setTimeout> | null;
}

let shared: Shared | null = null;

function current(create: () => WorkerSqlEngine): Shared {
  shared ??= { engine: create(), users: 0, idle: null };
  return shared;
}

/** The page's engine. Hold it while a step uses it, or it closes when idle. */
export function sqlEngine(
  create: () => WorkerSqlEngine = () => new WorkerSqlEngine(),
): WorkerSqlEngine {
  return current(create).engine;
}

/** Keeps the engine open until the returned function is called. */
export function holdSqlEngine(
  create: () => WorkerSqlEngine = () => new WorkerSqlEngine(),
): () => void {
  const held = current(create);
  if (held.idle !== null) clearTimeout(held.idle);
  held.idle = null;
  held.users += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held.users -= 1;
    if (held.users > 0) return;
    held.idle = setTimeout(() => {
      held.engine.dispose();
      if (shared === held) shared = null;
    }, IDLE_MS);
  };
}
