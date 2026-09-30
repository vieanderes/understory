import { WorkerTypeChecker } from '@/adapters/typecheck/worker-checker';
import type { TypeChecker } from '@/core/ports/type-checker';

/*
 * One checker worker per page, shared by every type-checked editor on it. The compiler
 * takes a moment to parse its library, so the worker outlives a step: moving on to the
 * next TypeScript step finds it warm. It is closed a while after the last editor goes,
 * because it holds tens of megabytes a phone would rather have back.
 */

const IDLE_MS = 60_000;

interface Shared {
  checker: WorkerTypeChecker;
  users: number;
  idle: ReturnType<typeof setTimeout> | null;
}

let shared: Shared | null = null;

export interface CheckerLease {
  checker: TypeChecker;
  release(): void;
}

export function acquireChecker(
  create: () => WorkerTypeChecker = () => new WorkerTypeChecker(),
): CheckerLease {
  shared ??= { checker: create(), users: 0, idle: null };
  const current = shared;
  if (current.idle !== null) clearTimeout(current.idle);
  current.idle = null;
  current.users += 1;
  let released = false;
  return {
    checker: current.checker,
    release() {
      if (released) return;
      released = true;
      current.users -= 1;
      if (current.users > 0) return;
      current.idle = setTimeout(() => {
        current.checker.dispose();
        if (shared === current) shared = null;
      }, IDLE_MS);
    },
  };
}
