import {
  sawText,
  type Built,
  type Outcome,
  type TxId,
  type TxState,
} from '@/core/labs/isolation-anomaly-stepper';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface TxColumnProps {
  built: Built;
  tx: TxState;
  canRun: boolean;
  onRunNext: (tx: TxId) => void;
  className?: string;
}

const STATUS: Record<TxState['status'], string> = {
  idle: 'not started',
  active: 'open',
  blocked: 'waiting',
  failed: 'aborted',
  committed: 'committed',
  'rolled-back': 'rolled back',
};

/** The outcome in figures: what a statement returned or how it ended, in a few characters. */
function badge(outcome: Outcome | undefined): string | null {
  if (!outcome) return null;
  if (outcome.status === 'blocked') return `waits for T${outcome.waitingOn?.holder ?? ''}`.trim();
  if (outcome.status === 'failed') return outcome.error?.sqlstate ?? 'failed';
  if (outcome.status === 'skipped') return 'not sent';
  if (outcome.status === 'ignored') return 'ignored';
  return null;
}

/**
 * One transaction as the SQL a session sends, with the statement it will send next
 * marked. The words under each statement are the same sentence the status line reads out.
 */
export function TxColumn({ built, tx, canRun, onRunNext, className }: TxColumnProps) {
  const lines = built.lines[tx.id];
  const finished = tx.status === 'committed' || tx.status === 'rolled-back';
  return (
    <section
      aria-label={`T${tx.id}, ${built.actors[tx.id]}`}
      className={cn('flex min-w-0 flex-col gap-1', className)}
    >
      <div className="flex items-baseline justify-between gap-1">
        <h2 className="font-medium">
          <span className="t-figure">{`T${tx.id}`}</span> {built.actors[tx.id]}
        </h2>
        <p className="t-label" data-testid={`t${tx.id}-status`}>
          {STATUS[tx.status]}
        </p>
      </div>
      <ol className="border-border bg-bg rounded-control flex flex-col border p-1">
        {lines.map((line, index) => {
          const outcome = tx.outcomes[index];
          const next = !finished && index === tx.pc;
          const params = outcome?.params ? Object.entries(outcome.params) : [];
          const mark = badge(outcome);
          return (
            <li
              key={index}
              data-line={index}
              data-next={next || undefined}
              aria-current={next ? 'step' : undefined}
              className={cn(
                'rounded-inner flex min-w-0 flex-col gap-0.5 px-1 py-0.5',
                next && 'bg-accent-tint',
              )}
            >
              <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-1">
                <code
                  className={cn(
                    'min-w-0 font-mono text-sm break-words whitespace-pre-wrap',
                    outcome === undefined && !next && 'text-muted',
                  )}
                >
                  {line.sql}
                </code>
                {next && outcome?.status !== 'blocked' ? (
                  <span className="t-label text-accent shrink-0">next</span>
                ) : mark ? (
                  <span className="t-label t-figure shrink-0">{mark}</span>
                ) : null}
              </div>
              {line.note ? <p className="text-muted text-sm">{line.note}</p> : null}
              {params.length > 0 ? (
                <p className="t-figure text-muted text-sm">
                  {params.map(([name, value]) => `:${name} = ${String(value)}`).join(', ')}
                </p>
              ) : null}
              {outcome ? <p className="text-sm">{sawText(line, outcome)}</p> : null}
            </li>
          );
        })}
      </ol>
      <Button
        size="md"
        variant="secondary"
        disabled={!canRun}
        onClick={() => onRunNext(tx.id)}
        className="self-start"
      >
        {`Run T${tx.id} next`}
      </Button>
    </section>
  );
}
