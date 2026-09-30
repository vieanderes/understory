'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { pathExamResult } from '@/core/exam';
import { percent, scoreTallies } from '@/core/online-test/score';
import {
  buildPlan,
  planPace,
  planProgress,
  type Pace,
  type Plan,
  type PlanAnswers,
  type PlanCatalog,
  type PlanFacts,
  type PlanItem,
  type PlanProgress,
} from '@/core/plan';
import { useProgress } from '@/features/store/StoreProvider';

/** Today as YYYY-MM-DD in the learner's time zone, re-read when the tab comes back. */
function localDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function subscribeDay(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

export function useToday(): string {
  return useSyncExternalStore(subscribeDay, localDate, () => '');
}

export interface PlanState {
  ready: boolean;
  answers: PlanAnswers | undefined;
  plan: Plan | undefined;
  progress: PlanProgress | undefined;
  pace: Pace | undefined;
  facts: PlanFacts;
  today: string;
}

/**
 * The learner's plan, derived: the answers from the event log, the phases from the
 * catalogue, progress from completed lessons, best test scores and passed exams.
 */
export function usePlan(catalog: PlanCatalog): PlanState {
  const { status, state } = useProgress();
  const ready = status === 'ready';
  const today = useToday();
  const answers = ready ? state.plan : undefined;

  const facts = useMemo<PlanFacts>(() => {
    const best: Record<string, number> = {};
    for (const attempt of state.onlineTests) {
      const score = percent(scoreTallies(attempt.tasks));
      best[attempt.testKey] = Math.max(best[attempt.testKey] ?? 0, score);
    }
    const passed = new Set(
      Object.entries(state.pathExams)
        .filter(([, attempts]) => pathExamResult(attempts).passed)
        .map(([id]) => id),
    );
    return { completedLessons: state.completedLessons, bestTestScores: best, passedExams: passed };
  }, [state.onlineTests, state.pathExams, state.completedLessons]);

  const plan = useMemo(
    () => (answers ? buildPlan(answers, catalog) : undefined),
    [answers, catalog],
  );
  const progress = useMemo(() => (plan ? planProgress(plan, facts) : undefined), [plan, facts]);
  const pace =
    plan && progress && answers && today ? planPace(plan, answers, progress, today) : undefined;
  return { ready, answers, plan, progress, pace, facts, today };
}

export function itemHref(item: PlanItem): string {
  switch (item.kind) {
    case 'lesson':
      return item.href ?? '/learn';
    case 'test':
      return `/practise/online-test/${item.key}`;
    case 'habit':
      return item.href;
  }
}

export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 30) / 2;
  return `${hours} h`;
}

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}
