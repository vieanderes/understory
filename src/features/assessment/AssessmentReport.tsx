'use client';

import { AlertTriangle, Check, ChevronRight, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { scoreAssessment, scoreTask, type TaskReport, type TestOutcome } from '@/core/assessment';
import type { CompiledCodeChallengeStep } from '@/core/content/compiled';
import { LazyCodeEditor } from '@/features/editor/LazyCodeEditor';
import { cn } from '@/lib/cn';

const OUTCOME: Record<TestOutcome, { label: string; Icon: typeof Check; tone: string }> = {
  passed: { label: 'OK', Icon: Check, tone: 'text-success' },
  'wrong-answer': { label: 'Wrong answer', Icon: X, tone: 'text-danger' },
  timeout: { label: 'Timed out', Icon: Clock, tone: 'text-danger' },
  error: { label: 'Runtime error', Icon: AlertTriangle, tone: 'text-danger' },
};

const percent = (share: number): string => `${Math.round(share * 100)}%`;

interface AssessmentReportProps {
  tasks: readonly CompiledCodeChallengeStep[];
  reports: readonly TaskReport[];
  /** Step id to reference solution, once loaded. */
  solutions: Readonly<Record<string, string>> | null;
}

/**
 * The platforms' report: one figure for the test, then per task the share of
 * correctness and performance tests passed and a verdict for every hidden test.
 */
export function AssessmentReport({ tasks, reports, solutions }: AssessmentReportProps) {
  const total = scoreAssessment(reports);
  return (
    <section aria-labelledby="report-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 id="report-title" className="t-label">
          Your score
        </h1>
        <p className="t-figure text-xl font-semibold" data-testid="assessment-score">
          {percent(total)}
        </p>
      </div>

      {tasks.map((task, index) => {
        const report = reports.find((r) => r.stepId === task.id);
        if (!report) return null;
        return (
          <TaskSummary
            key={task.id}
            number={index + 1}
            task={task}
            report={report}
            solution={solutions?.[task.id]}
          />
        );
      })}
    </section>
  );
}

function TaskSummary({
  number,
  task,
  report,
  solution,
}: {
  number: number;
  task: CompiledCodeChallengeStep;
  report: TaskReport;
  solution: string | undefined;
}) {
  const score = scoreTask(report);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  return (
    <section aria-label={`Task ${number}`} className="rule-t flex flex-col gap-2 pt-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-lg font-medium">
          Task <span className="t-figure">{number}</span>
        </h2>
        <Figure label="Task" value={percent(score.total)} />
        <Figure label="Correctness" value={percent(score.correctness)} />
        {score.performance === undefined ? null : (
          <Figure label="Performance" value={percent(score.performance)} />
        )}
      </div>

      {report.loadError ? (
        <p className="text-danger">
          The code did not run: {report.loadError.message}
          {report.loadError.line === undefined ? '' : ` (line ${report.loadError.line})`}. On the
          real platforms, code that does not compile scores 0.
        </p>
      ) : null}

      <ul className="flex flex-col" aria-label={`Hidden tests of task ${number}`}>
        {report.tests.map((test, i) => {
          const { label, Icon, tone } = OUTCOME[test.outcome];
          return (
            <li
              key={`${i}-${test.name}`}
              className="rule-b flex flex-wrap items-start gap-x-2 gap-y-0.5 py-1 text-sm"
            >
              <Icon aria-hidden size={16} strokeWidth={2} className={cn('mt-0.5 shrink-0', tone)} />
              <span className={cn('t-figure w-16 shrink-0', tone)}>{label}</span>
              <span className="min-w-0 flex-1">
                <span className="text-muted t-label mr-1">
                  {test.kind === 'performance' ? 'Performance' : 'Correctness'}
                </span>
                {test.name}
                {test.message && test.outcome !== 'passed' ? (
                  <span className="text-muted block font-mono">{test.message}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <details className="group" onToggle={(event) => setHiddenOpen(event.currentTarget.open)}>
        <summary className="hover:bg-raised rounded-control transition-press flex min-h-5 cursor-pointer list-none items-center gap-1 text-sm font-medium select-none">
          <ChevronRight
            aria-hidden
            size={16}
            strokeWidth={2}
            className="transition-press group-open:rotate-90"
          />
          Show the hidden tests
        </summary>
        {hiddenOpen ? (
          <div className="flex flex-col gap-1 pt-1">
            <LazyCodeEditor
              value={[task.hiddenCode, task.performanceCode].filter(Boolean).join('\n')}
              language={task.language}
              readOnly
              ariaLabel={`Hidden tests of task ${number}`}
              minLines={1}
            />
          </div>
        ) : null}
      </details>

      {solution === undefined ? null : (
        <details className="group">
          <summary className="hover:bg-raised rounded-control transition-press flex min-h-5 cursor-pointer list-none items-center gap-1 text-sm font-medium select-none">
            <ChevronRight
              aria-hidden
              size={16}
              strokeWidth={2}
              className="transition-press group-open:rotate-90"
            />
            Show a reference solution
          </summary>
          <div className="pt-1">
            <LazyCodeEditor
              value={solution}
              language={task.language}
              readOnly
              ariaLabel={`Reference solution of task ${number}`}
              minLines={1}
            />
          </div>
        </details>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline gap-1">
      <span className="t-label">{label}</span>
      <span className="t-figure text-lg font-medium">{value}</span>
    </p>
  );
}
