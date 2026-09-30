import { Check, X } from 'lucide-react';
import type { World } from '@/core/labs/overselling-simulator';
import { cn } from '@/lib/cn';
import { formatCount, type Enumeration } from './enumeration';
import { lostTheSale } from './frames';

interface VerdictProps {
  world: World;
  /** The tick at which sold first went above capacity, or null while it holds. */
  brokenAt: number | null;
  enumeration: Enumeration;
  /** Every actor has finished, so the verdict is final rather than provisional. */
  finished: boolean;
  className?: string;
}

/**
 * The invariant, and how many of the orderings break it. Success and danger appear here
 * and nowhere else in this lab: they are the verdict, not decoration.
 */
export function Verdict({ world, brokenAt, enumeration, finished, className }: VerdictProps) {
  const { sold, capacity } = world.store;
  const broken = brokenAt !== null;
  const lost = lostTheSale(world);

  return (
    <section aria-label="Verdict" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <h2 className="t-label">Verdict</h2>
      <p
        data-testid="invariant"
        data-broken={broken}
        className={cn(
          'flex items-baseline gap-1 font-medium',
          broken ? 'text-danger' : 'text-success',
        )}
      >
        <span aria-hidden className="translate-y-0.5 self-start">
          {broken ? <X size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
        </span>
        <span>
          <span className="t-figure">{`sold <= capacity: ${sold} ${broken ? '>' : '<='} ${capacity}. `}</span>
          {broken ? `Broken first at tick ${brokenAt}.` : finished ? 'Holds.' : 'Holds so far.'}
        </span>
      </p>

      {lost ? (
        <p data-testid="lost-sale" className="prose-measure font-medium">
          Nothing was oversold, and nothing was sold. The sweep won the race and released the hold,
          the late payment found no hold to confirm and was refunded, and the buyer who waited had
          already been told the event was sold out. The ticket is back in stock with nobody left to
          buy it: the cost of this design is a lost sale, not a wrong number.
        </p>
      ) : null}

      <p data-testid="enumeration" className="text-muted prose-measure text-sm">
        {enumeration.kind === 'too-large' ? (
          'This case has too many orderings to enumerate here.'
        ) : (
          <>
            <span className="t-figure text-fg">
              {enumeration.oversold === 0n
                ? `None of the ${formatCount(enumeration.total)} orderings`
                : `${formatCount(enumeration.oversold)} of ${formatCount(enumeration.total)} orderings`}
            </span>
            {' oversell. '}
            {enumeration.listable
              ? 'Few enough to run one at a time.'
              : 'Too many to run one at a time: that is how a race like this stays under a green test suite.'}
          </>
        )}
      </p>
    </section>
  );
}
