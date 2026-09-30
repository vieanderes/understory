import type { SqlResultSet } from '@/core/sql';
import { cn } from '@/lib/cn';

interface ResultTableProps {
  result: SqlResultSet;
  /** Names the table for a screen reader, and the scroll region around it. */
  label: string;
  className?: string;
}

const count = (n: number): string => (n === 1 ? '1 row' : `${n} rows`);

/**
 * Rows as Postgres returned them, in a real table: a header cell per column, so a screen
 * reader names the column of every value. A wide result scrolls inside its own region,
 * never the page, and the region takes focus so a keyboard can scroll it too. NULL is
 * shown as a muted `null`, apart from the text 'null'.
 */
export function ResultTable({ result, label, className }: ResultTableProps) {
  const { columns, rows, rowCount, truncated } = result;
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="border-border rounded-inner overflow-x-auto border outline-offset-2"
      >
        <table className="w-full border-collapse font-mono text-sm">
          <caption className="sr-only">
            {label}, {count(rowCount)}
          </caption>
          <thead className="bg-sunken">
            <tr>
              {columns.map((column, i) => (
                <th
                  // Two columns may share a name: `select 1 as a, 2 as a`.
                  key={`${i}-${column}`}
                  scope="col"
                  className="px-1 py-0.5 text-left font-medium whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-border border-t">
                {row.map((cell, c) => (
                  <td key={c} className="px-1 py-0.5 align-top whitespace-pre">
                    {cell === null ? <span className="text-muted">null</span> : cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr className="border-border border-t">
                <td colSpan={Math.max(1, columns.length)} className="text-muted px-1 py-0.5">
                  No rows
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {truncated ? (
        <p className="text-muted text-sm">
          Showing the first {rows.length} of {rowCount} rows.
        </p>
      ) : null}
    </div>
  );
}
