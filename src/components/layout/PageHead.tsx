import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeadProps {
  /** The micro label above the title: where you are, never a sentence. */
  label: ReactNode;
  /** The page title, usually a `<Title>` so it arrives like every other. */
  title: ReactNode;
  lede?: ReactNode;
  /** Controls that belong to the title, such as the News period tabs. */
  actions?: ReactNode;
  /** The right-hand column: a ledger of figures or a short index. Stacks under on a phone. */
  aside?: ReactNode;
  /** For an aside that should wait until after the page's first action on a phone. */
  asideClassName?: string;
  className?: string;
}

/**
 * The masthead every place shares, so Learn, Practise, Map and News read as one publication:
 * a label, the title, one sentence of lede, and figures to the right on the same baseline.
 */
export function PageHead({
  label,
  title,
  lede,
  actions,
  aside,
  asideClassName,
  className,
}: PageHeadProps) {
  return (
    <header
      className={cn(
        'grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12 md:gap-y-4 md:pt-4',
        className,
      )}
    >
      <div className="col-span-4 flex min-w-0 flex-col gap-2 md:col-span-7 lg:col-span-8">
        <p className="t-label">{label}</p>
        {title}
        {lede ? (
          <p data-arrive="rise" className="text-muted prose-measure">
            {lede}
          </p>
        ) : null}
        {actions ? (
          <div data-arrive="rise" className="pt-1">
            {actions}
          </div>
        ) : null}
      </div>
      {aside ? (
        <div
          data-arrive="rise"
          className={cn(
            'col-span-4 flex min-w-0 flex-col justify-end md:col-span-5 lg:col-span-4',
            asideClassName,
          )}
        >
          {aside}
        </div>
      ) : null}
    </header>
  );
}

export interface LedgerRow {
  label: string;
  /** The name on a phone, where three figures share one line. */
  short?: string;
  value: ReactNode;
  /** A short unit or qualifier after the value, quieter than it. */
  unit?: string;
  /** Accent only for a gap, as everywhere. */
  gap?: boolean;
}

/**
 * Figures and their names. On a phone they sit side by side in one band, number over name,
 * so they cost one line of the first screen. From `md` they become a column, one hairline
 * each, the name small on the left and the number larger on the right.
 */
export function Ledger({
  rows,
  footnote,
  className,
}: {
  rows: LedgerRow[];
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <dl
        className={cn(
          'border-border grid gap-x-2 gap-y-1 border-t pt-1 md:flex md:flex-col md:border-t-0 md:pt-0',
          rows.length === 4 ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className="md:border-border flex min-w-0 flex-col-reverse gap-0.5 md:min-h-6 md:flex-row md:items-baseline md:justify-between md:gap-2 md:border-t md:py-1"
          >
            <dt className="t-label">
              <span className="md:hidden">{row.short ?? row.label}</span>
              <span className="hidden md:inline">{row.label}</span>
            </dt>
            <dd className="flex items-baseline gap-0.5">
              <span className={cn('t-figure text-lg', row.gap && 'text-accent')}>{row.value}</span>
              {row.unit ? <span className="t-figure text-muted text-sm">{row.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {footnote ? <div className="rule-t hidden pt-1 md:block">{footnote}</div> : null}
    </div>
  );
}
