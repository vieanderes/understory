import { STORE_WHERE, type StoreRow } from '@/core/labs/cache-layer-explorer';
import { cn } from '@/lib/cn';

interface StoresProps {
  rows: readonly StoreRow[];
  className?: string;
}

/**
 * The stores an answer can come from, nearest the learner first. The row that answered
 * the step just taken carries the accent, so the eye lands on it before reading a word.
 */
export function Stores({ rows, className }: StoresProps) {
  return (
    <section aria-label="Cache stores" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <h2 className="t-label">Where the answer can come from</h2>
      <div
        role="region"
        aria-label="Cache stores and what they hold"
        tabIndex={0}
        className="border-border bg-bg rounded-control min-w-0 overflow-x-auto border"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="rule-b">
              <th scope="col" className="t-label px-1 py-0.5 text-left">
                Store
              </th>
              <th scope="col" className="t-label px-1 py-0.5 text-left">
                Holds
              </th>
              <th scope="col" className="t-label px-1 py-0.5 text-left">
                State
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                data-testid="store-row"
                data-store={row.store}
                data-answered={row.answered}
                className={cn(row.answered && 'bg-accent-tint')}
              >
                <th scope="row" className="px-1 py-0.5 text-left align-top font-normal">
                  <span className={cn('block', row.answered ? 'text-accent font-medium' : '')}>
                    {row.name}
                  </span>
                  {row.showWhere ? (
                    <span className="text-muted block text-sm">{STORE_WHERE[row.store]}</span>
                  ) : null}
                </th>
                <td className="t-figure px-1 py-0.5 align-top">{row.holds}</td>
                <td
                  className={cn(
                    't-figure px-1 py-0.5 align-top whitespace-nowrap',
                    row.state === 'empty' ? 'text-muted' : 'font-medium',
                  )}
                >
                  {row.state}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
