import { Check, ChevronRight, X } from 'lucide-react';
import type { RunResult } from '@/core/ports/code-runner';
import { cn } from '@/lib/cn';
import { VerdictMark } from './VerdictMark';

interface TestResultsProps {
  /** The latest run, or null before the first one. */
  result: RunResult | null;
  running: boolean;
  /** Shown while running: "Running", or what a first Python run loads ("Loading numpy…"). */
  runningLabel?: string;
  /** The budget the run had, so a timeout can say how long it waited. */
  timeoutMs: number;
}

const ERROR_LABEL: Readonly<Record<string, string>> = {
  SyntaxError: 'Syntax error',
  TranspileError: 'Syntax error',
  ReferenceError: 'Reference error',
  TypeError: 'Type error',
  RangeError: 'Range error',
};

/** One sentence that says where the run stands. Exported for the unit tests. */
export function statusLine(result: RunResult, timeoutMs: number): string {
  if (result.status === 'passed') return 'All tests pass';
  if (result.status === 'timeout') {
    const seconds = Math.round(timeoutMs / 100) / 10;
    return `Timed out after ${seconds} s: look for a loop that never ends`;
  }
  if (result.status === 'error') {
    const error = result.error;
    if (!error) return 'The code stopped with an error';
    const label = ERROR_LABEL[error.name];
    // A sandbox or request problem is not the learner's error: its message stands alone.
    if (!label) return error.message;
    return error.line === undefined
      ? `${label}: ${error.message}`
      : `${label} on line ${error.line}: ${error.message}`;
  }
  const passed = result.tests.filter((t) => t.passed).length;
  return `${passed} of ${result.tests.length} pass`;
}

/**
 * What the last run found. The status line sits in a live region that exists before the
 * first run, because a screen reader only announces changes to a region it already knows.
 */
export function TestResults({
  result,
  running,
  runningLabel = 'Running',
  timeoutMs,
}: TestResultsProps) {
  const passed = result?.status === 'passed';
  const StatusIcon = passed ? Check : X;

  return (
    <section aria-label="Test results" className="flex flex-col gap-1">
      <p className="t-label">Tests</p>
      <div role="status" data-testid="run-status" data-status={result?.status ?? 'idle'}>
        {running ? (
          <p className="text-muted font-mono text-sm">{runningLabel}</p>
        ) : result ? (
          <p
            className={cn(
              'flex items-start gap-1 font-medium',
              passed ? 'text-success' : result.status === 'failed' ? 'text-fg' : 'text-danger',
            )}
          >
            {result.status === 'failed' ? null : (
              <StatusIcon aria-hidden size={20} strokeWidth={2} className="mt-0.25 shrink-0" />
            )}
            <span className={result.status === 'failed' ? 't-figure' : undefined}>
              {statusLine(result, timeoutMs)}
            </span>
          </p>
        ) : (
          <p className="text-muted font-mono text-sm">Not run yet</p>
        )}
      </div>

      {result && result.tests.length > 0 ? (
        <ul className="flex flex-col">
          {result.tests.map((test, index) => (
            <li
              // Two tests may share a name. Their order does not change within one run.
              key={`${index}-${test.name}`}
              data-testid="test-row"
              data-passed={test.passed}
              className="rule-t stream-in flex items-start gap-1 py-1"
              style={{ '--i': index } as React.CSSProperties}
            >
              <VerdictMark
                right={test.passed}
                label={test.passed ? 'Passed' : 'Failed'}
                className="h-2.5"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm">{test.name}</p>
                {!test.passed && test.message ? (
                  <p className="text-muted font-mono text-sm break-words whitespace-pre-wrap">
                    {test.message}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {result && result.logs.length > 0 ? (
        <details className="group rule-t">
          <summary className="hover:bg-raised rounded-control transition-press flex min-h-5 cursor-pointer list-none items-center gap-1 text-sm font-medium select-none">
            <ChevronRight
              aria-hidden
              size={16}
              strokeWidth={2}
              className="transition-press group-open:rotate-90"
            />
            Console
            <span className="t-figure text-muted ml-auto text-sm font-normal">
              {result.logs.length === 1 ? '1 line' : `${result.logs.length} lines`}
            </span>
          </summary>
          <pre
            tabIndex={0}
            aria-label="Console output"
            className="bg-surface border-border rounded-control text-fg mt-0.5 mb-1 max-h-30 overflow-auto border p-1 font-mono text-sm"
          >
            {result.logs.join('\n')}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
