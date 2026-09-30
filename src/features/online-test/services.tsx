'use client';

import { createContext, use, type ReactNode } from 'react';
import {
  compiledTaskGuideSchema,
  compiledTaskSchema,
  type CompiledTaskGuide,
  platformCompileErrors,
  solutionsFileSchema,
  type CompiledTask,
  type TaskLanguage,
} from '@/core/online-test';
import type { CodeRunner } from '@/core/ports/code-runner';

/*
 * What the simulator needs from outside React, in one place so tests can swap it: the
 * compiled tasks, the sandbox, the TypeScript checker and the reference solutions. The
 * defaults load lazily, so the hub page pays for none of it.
 */

export interface OnlineTestServices {
  loadTask(id: string): Promise<CompiledTask>;
  runner(): Promise<CodeRunner>;
  /** Compiler errors in the platform's format, or [] when the code compiles. */
  typeErrors(code: string): Promise<string[]>;
  loadSolutions(): Promise<Record<string, Record<TaskLanguage, string>>>;
  /** The task's guide for guided mode, or null when it has none. */
  loadGuide(id: string): Promise<CompiledTaskGuide | null>;
}

const BASE = '/content/v1/online-tests';

const taskCache = new Map<string, Promise<CompiledTask>>();

async function fetchTask(id: string): Promise<CompiledTask> {
  const response = await fetch(`${BASE}/tasks/${encodeURIComponent(id)}.json`);
  if (!response.ok) throw new Error(`Task ${id} could not be loaded.`);
  return compiledTaskSchema.parse(await response.json());
}

let sandbox: Promise<CodeRunner> | undefined;

export const defaultServices: OnlineTestServices = {
  loadTask(id) {
    let hit = taskCache.get(id);
    if (!hit) {
      hit = fetchTask(id);
      hit.catch(() => taskCache.delete(id));
      taskCache.set(id, hit);
    }
    return hit;
  },
  runner() {
    sandbox ??= import('@/features/editor/sandbox-runner').then((m) => m.createSandboxRunner());
    sandbox.catch(() => {
      sandbox = undefined;
    });
    return sandbox;
  },
  async typeErrors(code) {
    const { acquireChecker } = await import('@/features/editor/typecheck/shared-checker');
    const lease = acquireChecker();
    try {
      const outcome = await lease.checker.check({ code, tests: '' });
      if (outcome.status !== 'checked') return [];
      return platformCompileErrors(outcome.diagnostics);
    } finally {
      lease.release();
    }
  },
  async loadGuide(id) {
    const response = await fetch(`${BASE}/guides/${encodeURIComponent(id)}.json`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('The guide could not be loaded.');
    return compiledTaskGuideSchema.parse(await response.json());
  },
  async loadSolutions() {
    const response = await fetch(`${BASE}/solutions.json`);
    if (!response.ok) throw new Error('Solutions could not be loaded.');
    return solutionsFileSchema.parse(await response.json());
  },
};

const ServicesContext = createContext<OnlineTestServices>(defaultServices);

export function OnlineTestServicesProvider({
  services,
  children,
}: {
  services: OnlineTestServices;
  children: ReactNode;
}) {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

export function useServices(): OnlineTestServices {
  return use(ServicesContext);
}

/** One promise per list of ids, so Suspense sees the same promise on every render. */
const listCaches = new WeakMap<OnlineTestServices, Map<string, Promise<CompiledTask[]>>>();

export function tasksPromise(
  services: OnlineTestServices,
  ids: readonly string[],
): Promise<CompiledTask[]> {
  let listCache = listCaches.get(services);
  if (!listCache) {
    listCache = new Map();
    listCaches.set(services, listCache);
  }
  const key = ids.join(',');
  let hit = listCache.get(key);
  if (!hit) {
    hit = Promise.all(ids.map((id) => services.loadTask(id)));
    hit.catch(() => listCache.delete(key));
    listCache.set(key, hit);
  }
  return hit;
}
