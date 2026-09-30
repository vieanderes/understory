import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PredictionRow {
  label: string;
  /** What the engine worked out, in px. */
  predicted: number;
  /** What the browser measured, in px. Null until the stage has been measured. */
  measured: number | null;
}

interface PredictionTableProps {
  caption: string;
  rows: readonly PredictionRow[];
  /** Before the reveal the measured column stays closed. */
  revealed: boolean;
  /** How far apart the two may be and still agree. Browsers lay out in 1/64 px. */
  tolerance?: number;
  format: (value: number) => string;
}

/**
 * Prediction and measurement side by side. The verdict is the one place this lab uses
 * success or danger: the arithmetic either matches the browser or it does not.
 */
export function PredictionTable({
  caption,
  rows,
  revealed,
  tolerance = 0.5,
  format,
}: PredictionTableProps) {
  return (
    <table className="w-full text-sm">
      <caption className="t-label pb-1 text-left">{caption}</caption>
      <thead>
        <tr className="rule-b text-muted">
          <th scope="col" className="py-1 pr-1 text-left font-normal">
            Size
          </th>
          <th scope="col" className="py-1 pl-1 text-right font-normal">
            Predicted
          </th>
          <th scope="col" className="py-1 pl-1 text-right font-normal">
            Measured
          </th>
          <th scope="col" className="w-4 py-1 pl-1 text-right font-normal">
            <span className="sr-only">Verdict</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const known = revealed && row.measured !== null;
          const agrees = known && Math.abs(row.measured! - row.predicted) <= tolerance;
          return (
            <tr key={row.label} className="rule-b" data-row={row.label}>
              <th scope="row" className="py-1 pr-1 text-left font-normal">
                {row.label}
              </th>
              <td className="t-figure py-1 pl-1 text-right" data-predicted={row.predicted}>
                {format(row.predicted)}
              </td>
              <td
                className={cn('t-figure py-1 pl-1 text-right', !known && 'text-faint')}
                data-measured={known ? row.measured : undefined}
              >
                {known ? format(row.measured!) : revealed ? 'n/a' : 'hidden'}
              </td>
              <td className="py-1 pl-1 text-right">
                {known ? (
                  <span
                    className={cn(
                      'inline-flex align-middle',
                      agrees ? 'text-success' : 'text-danger',
                    )}
                  >
                    {agrees ? (
                      <Check aria-hidden size={16} strokeWidth={2} />
                    ) : (
                      <X aria-hidden size={16} strokeWidth={2} />
                    )}
                    <span className="sr-only">{agrees ? 'Matches' : 'Differs'}</span>
                  </span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
