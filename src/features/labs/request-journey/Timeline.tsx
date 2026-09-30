import type { Journey } from '@/core/labs/request-journey';
import { cn } from '@/lib/cn';

interface TimelineProps {
  run: Journey;
  index: number;
  /** After one full run the whole bar stays visible, so a changed condition shows at once. */
  revealed: boolean;
  previousTotalMs: number | null;
  /** False inside a figure, where a heading would break the outline of the page around it. */
  heading?: boolean;
}

/** Milliseconds per hop as one flat stacked bar, with the figures in a table beneath. */
export function Timeline({ run, index, revealed, previousTotalMs, heading = true }: TimelineProps) {
  const seen = run.frames.slice(0, index + 1);
  const current = run.frames[index]!;
  const finished = index === run.frames.length - 1;
  const order = run.breakdown.map((entry) => entry.hop);
  const furthest = Math.max(
    ...seen.map((frame) => (frame.hop === 'start' ? -1 : order.indexOf(frame.hop))),
  );

  const rows = run.breakdown.map((entry, at) => {
    const spent = seen.reduce(
      (sum, frame) => (frame.hop === entry.hop ? sum + frame.costMs : sum),
      0,
    );
    const hasFrames = run.frames.some((frame) => frame.hop === entry.hop);
    // A hop that was skipped has no step of its own: it counts as passed once a later hop runs.
    const reached = hasFrames ? seen.some((frame) => frame.hop === entry.hop) : at < furthest;
    return { ...entry, spent, reached, active: current.hop === entry.hop };
  });
  const share = (value: number) => (run.totalMs === 0 ? 0 : (value / run.totalMs) * 100);

  return (
    <section aria-label="Timeline" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        {heading ? <h2 className="t-label">Timeline</h2> : <p className="t-label">Timeline</p>}
        <p className="text-sm">
          <span className="t-figure text-lg font-medium">{current.elapsedMs} ms</span>
          {revealed ? <span className="t-figure text-muted"> of {run.totalMs} ms</span> : null}
          {revealed && previousTotalMs !== null && previousTotalMs !== run.totalMs ? (
            <span className="t-figure text-muted"> · was {previousTotalMs} ms</span>
          ) : null}
        </p>
      </div>

      <div aria-hidden className="bg-sunken rounded-inner flex h-3 w-full gap-px overflow-hidden">
        {rows
          .filter((row) => row.ms > 0)
          .flatMap((row) => [
            <div
              key={row.hop}
              data-hop={row.hop}
              className={cn(
                'h-full transition-opacity duration-150 ease-out',
                row.active ? 'bg-accent' : 'bg-fg',
              )}
              style={{ width: `${share(row.spent)}%` }}
            />,
            revealed && row.spent < row.ms ? (
              <div
                key={`${row.hop}-rest`}
                className="border-faint h-full border"
                style={{ width: `${share(row.ms - row.spent)}%` }}
              />
            ) : null,
          ])}
      </div>

      <div className="prose-measure overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Milliseconds per hop</caption>
          <thead>
            <tr className="rule-b">
              <th scope="col" className="t-label py-1 text-left font-normal">
                Hop
              </th>
              <th scope="col" className="t-label py-1 text-right font-normal">
                ms
              </th>
              <th scope="col" className="t-label py-1 pl-2 text-right font-normal">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const known = row.reached || revealed;
              const value = revealed && !row.reached ? row.ms : row.spent;
              const dominant = (finished || revealed) && run.dominant.includes(row.hop);
              const weight = dominant
                ? 'font-semibold'
                : row.active
                  ? 'font-medium'
                  : 'font-normal';
              return (
                <tr
                  key={row.hop}
                  data-hop={row.hop}
                  className={cn('rule-b', !known && 'text-faint', row.active && 'text-accent')}
                >
                  <th scope="row" className={cn('py-1 text-left', weight)}>
                    {row.label}
                    {dominant ? <span className="t-label pl-1">most</span> : null}
                    {known && row.skipped ? (
                      <span className="text-muted block font-normal">{row.skipped}</span>
                    ) : null}
                  </th>
                  <td className={cn('t-figure py-1 text-right align-top', weight)}>
                    {known ? value : ''}
                  </td>
                  <td className="t-figure text-muted py-1 pl-2 text-right align-top font-normal">
                    {known ? `${Math.round(share(value))}%` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
