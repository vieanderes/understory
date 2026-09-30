'use client';

import { useSyncExternalStore } from 'react';
import {
  codeOf,
  detectComplexity,
  evaluateSubmission,
  scoreTask,
  tally,
  type AttemptState,
  type CompiledTask,
} from '@/core/online-test';
import type { PayloadOf } from '@/core/progress/events';
import { readReport, saveReport, type ReportTask } from './attempt-store';
import type { OnlineTestServices } from './services';

/*
 * Scoring after submit. It runs outside React, once per attempt, and survives the page
 * being reloaded half way: the attempt is stored as submitted, so the next load finds no
 * report and starts again. Progress is an external store the scoring screen reads.
 */

export interface ScoringProgress {
  task: number;
  tasks: number;
  done: number;
  total: number;
}

const progress = new Map<string, ScoringProgress>();
const running = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function publish(attemptId: string, value: ScoringProgress): void {
  progress.set(attemptId, value);
  listeners.forEach((notify) => notify());
}

export function useScoringProgress(attemptId: string): ScoringProgress | undefined {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => progress.get(attemptId),
    () => undefined,
  );
}

type Record = (payload: PayloadOf<'online_test_submitted'>) => Promise<unknown>;

export function ensureScoring(
  attempt: AttemptState,
  tasks: readonly CompiledTask[],
  services: OnlineTestServices,
  record: Record,
): Promise<void> {
  if (attempt.phase !== 'submitted' || readReport(attempt.id)) return Promise.resolve();
  let job = running.get(attempt.id);
  if (!job) {
    job = score(attempt, tasks, services, record).finally(() => running.delete(attempt.id));
    running.set(attempt.id, job);
  }
  return job;
}

async function score(
  attempt: AttemptState,
  tasks: readonly CompiledTask[],
  services: OnlineTestServices,
  record: Record,
): Promise<void> {
  const runner = await services.runner();
  const reportTasks: ReportTask[] = [];
  for (const [index, task] of tasks.entries()) {
    const { language, code } = codeOf(attempt, task.id);
    publish(attempt.id, { task: index + 1, tasks: tasks.length, done: 0, total: 0 });
    const compileErrors = language === 'ts' ? await services.typeErrors(code) : [];
    const { result, samples } = await evaluateSubmission(runner, task, language, code, {
      compileErrors,
      starter: task.starters[language],
      onProgress: (done, total) =>
        publish(attempt.id, { task: index + 1, tasks: tasks.length, done, total }),
    });
    const complexity =
      task.type === 'algorithmic' && !result.compileErrors ? detectComplexity(samples) : undefined;
    reportTasks.push({
      taskId: task.id,
      title: task.title,
      language,
      code,
      result,
      ...(complexity ? { complexity } : {}),
    });
  }

  saveReport({ attemptId: attempt.id, attempt, tasks: reportTasks });
  const spec = attempt.spec;
  await record({
    attemptId: attempt.id,
    testKey: spec.key,
    title: spec.title,
    mode: spec.mode,
    minutes: spec.minutes,
    startedAt: new Date(attempt.startedAt ?? attempt.createdAt).toISOString(),
    submittedAt: new Date(attempt.submittedAt ?? attempt.createdAt).toISOString(),
    reason: attempt.submitReason ?? 'candidate',
    tasks: reportTasks.map((t) => {
      const zeroedBy = scoreTask(t.result).zeroedBy;
      return {
        taskId: t.taskId,
        language: t.language,
        type: t.result.type,
        correctness: tally(t.result, 'correctness'),
        performance: tally(t.result, 'performance'),
        ...(zeroedBy ? { zeroedBy } : {}),
        ...(t.complexity ? { complexity: t.complexity } : {}),
      };
    }),
    assistantPrompts: attempt.assistant.filter((m) => m.role === 'user').length,
    ...(attempt.guideUsed ? { guided: true } : {}),
  });
}
