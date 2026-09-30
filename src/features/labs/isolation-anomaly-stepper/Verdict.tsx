import { Check, X } from 'lucide-react';
import {
  TX_IDS,
  applicationLine,
  invariantText,
  serialText,
  verdictHeadline,
  type Built,
  type EngineState,
  type Verdict as VerdictData,
} from '@/core/labs/isolation-anomaly-stepper';
import { cn } from '@/lib/cn';

interface VerdictProps {
  built: Built;
  state: EngineState;
  /** Null while a transaction is still open. */
  verdict: VerdictData | null;
  className?: string;
}

/**
 * Serialisable or not, and the scenario's rule. Success and danger appear here and nowhere
 * else in the lab: they are the verdict, not decoration.
 */
export function Verdict({ built, state, verdict, className }: VerdictProps) {
  if (!verdict) {
    return (
      <section aria-label="Verdict" className={cn('flex flex-col gap-1', className)}>
        <h2 className="t-label">Verdict</h2>
        <p className="text-muted text-sm">The verdict comes when both transactions end.</p>
      </section>
    );
  }
  const rule = invariantText(verdict);
  const good = verdict.invariant ? verdict.invariant.holds : verdict.serialisable;
  return (
    <section aria-label="Verdict" className={cn('flex flex-col gap-1', className)}>
      <h2 className="t-label">Verdict</h2>
      <p
        data-testid="verdict"
        data-serialisable={verdict.serialisable}
        className="flex items-baseline gap-1 font-medium"
      >
        <span
          aria-hidden
          className={cn('translate-y-0.5 self-start', good ? 'text-success' : 'text-danger')}
        >
          {good ? <Check size={16} strokeWidth={2} /> : <X size={16} strokeWidth={2} />}
        </span>
        <span>{verdictHeadline(verdict)}</span>
      </p>
      {rule ? (
        <p
          data-testid="invariant"
          data-holds={verdict.invariant?.holds}
          className={cn('font-medium', verdict.invariant?.holds ? 'text-success' : 'text-danger')}
        >
          {rule}
        </p>
      ) : null}
      <ul className="prose-measure flex flex-col gap-0.5 text-sm">
        {TX_IDS.map((tx) => (
          <li key={tx}>{applicationLine(built, state, tx)}</li>
        ))}
        {verdict.serial.map((s) => (
          <li key={s.order.join('-')} className="text-muted">
            {serialText(built, state, s)}
          </li>
        ))}
      </ul>
    </section>
  );
}
