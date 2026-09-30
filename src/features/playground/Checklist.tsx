import { Check, Circle } from 'lucide-react';
import type { CheckResult, PlaygroundCheck } from '@/core/playground';
import { InlineMd } from '@/features/lesson-player/parts/InlineMd';
import { cn } from '@/lib/cn';

interface ChecklistProps {
  checks: readonly PlaygroundCheck[];
  /** Null until the preview has reported once. */
  results: readonly CheckResult[] | null;
  /** Once the learner has asked for a check, an open item says what is still missing. */
  explain: boolean;
}

/**
 * What the page must do, ticking live as the learner types. An open item is quiet, not a
 * warning: nothing is wrong with a page that is not finished yet.
 */
export function Checklist({ checks, results, explain }: ChecklistProps) {
  const passed = results?.filter((result) => result.passed).length ?? 0;
  return (
    <section aria-labelledby="playground-checks" className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="playground-checks" className="t-label">
          Checks
        </h3>
        <p role="status" className="t-figure text-muted text-sm">
          {results === null ? 'Waiting for the page' : `${passed} of ${checks.length} pass`}
        </p>
      </div>
      <ul className="flex flex-col">
        {checks.map((check, i) => {
          const result = results?.[i];
          const ok = result?.passed === true;
          const Icon = ok ? Check : Circle;
          return (
            <li
              key={i}
              data-testid="playground-check"
              data-passed={ok}
              className="rule-t flex gap-1 py-1"
            >
              <Icon
                aria-hidden
                size={20}
                strokeWidth={2}
                className={cn('mt-0.5 shrink-0', ok ? 'text-success verdict-pop' : 'text-faint')}
              />
              <div className="flex min-w-0 flex-col">
                <p className={cn(ok ? 'text-fg' : 'text-muted')}>
                  <InlineMd text={check.label} />
                  <span className="sr-only">{ok ? ', passes' : ', not yet'}</span>
                </p>
                {explain && !ok && result?.reason ? (
                  <p className="text-muted font-mono text-sm break-words">{result.reason}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
