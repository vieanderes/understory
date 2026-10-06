import { Check } from 'lucide-react';
import { formatMinutes, type WeekActivity } from '@/core/insight';
import { cn } from '@/lib/cn';

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const weekLabel = (week: WeekActivity) =>
  week.current ? 'This week' : DAY.format(new Date(`${week.start}T12:00:00Z`));

/** A clean top for the scale: the next of 30 min, 1 h, 2 h, 4 h... above the tallest week. */
function scaleTop(max: number): number {
  let top = 30;
  while (top < max) top *= 2;
  return top;
}

/** The week names under the columns. A phone names the first and the current week only. */
function WeekLabels({ weeks, ticks }: { weeks: readonly WeekActivity[]; ticks: boolean }) {
  return (
    <div aria-hidden className="flex gap-0.5 sm:gap-1">
      {weeks.map((week, i) => (
        <div key={week.weekKey} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          {ticks ? (
            <span className="text-muted flex h-2 items-center">
              {week.met ? <Check size={16} strokeWidth={2} /> : null}
            </span>
          ) : null}
          <span
            className={cn(
              't-label truncate',
              i !== 0 && !week.current && 'hidden lg:block',
              week.current && 'text-fg',
            )}
          >
            {weekLabel(week)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Time per week as columns, one series in ink: the current week full ink, past weeks
 * muted. A tick under a week means its XP goal was met. Values show on hover and on the
 * current week only; the table beside it carries every number.
 */
export function WeekChart({ weeks }: { weeks: readonly WeekActivity[] }) {
  const top = scaleTop(Math.max(0, ...weeks.map((w) => w.minutes)));
  const total = weeks.reduce((sum, w) => sum + w.minutes, 0);
  const met = weeks.filter((w) => w.met).length;
  const summary = `About ${formatMinutes(total)} over the last ${weeks.length} weeks. Goal met in ${met} of them.`;

  return (
    <figure className="flex flex-col gap-2">
      <div role="img" aria-label={summary} className="flex flex-col gap-1">
        <p aria-hidden className="t-label t-figure text-right">
          {formatMinutes(top)}
        </p>
        <div className="border-border flex h-20 items-end gap-0.5 border-t border-b sm:gap-1">
          {weeks.map((week) => {
            const share = week.minutes / top;
            return (
              <div
                key={week.weekKey}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
              >
                <span
                  aria-hidden
                  className={cn(
                    't-figure absolute text-sm transition-opacity duration-150 ease-out',
                    week.current
                      ? 'text-fg opacity-100'
                      : 'text-muted opacity-0 group-hover:opacity-100',
                  )}
                  style={{ bottom: `calc(${share * 100}% + 4px)` }}
                >
                  {week.minutes > 0 ? formatMinutes(week.minutes) : ''}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'rounded-t-inner w-full max-w-3 transition-colors duration-150 ease-out',
                    week.current ? 'bg-fg' : 'bg-faint group-hover:bg-muted',
                  )}
                  style={{ height: week.minutes > 0 ? `max(2px, ${share * 100}%)` : '0' }}
                />
              </div>
            );
          })}
        </div>
        <WeekLabels weeks={weeks} ticks={met > 0} />
      </div>
      {met > 0 ? (
        <figcaption className="text-muted flex items-center gap-0.5 text-sm">
          <Check aria-hidden size={16} strokeWidth={2} />
          Weekly XP goal met, counting all learning
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * Eight quiet weeks before the first one with anything in it: the baseline the chart will
 * grow from, so the section reads as waiting, not broken.
 */
export function WeekBaseline({ weeks }: { weeks: readonly WeekActivity[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden className="border-border flex h-3 items-end gap-0.5 border-b sm:gap-1">
        {weeks.map((week) => (
          <div key={week.weekKey} className="flex min-w-0 flex-1 justify-center">
            <span
              className={cn(
                'rounded-t-inner h-0.5 w-full max-w-3',
                week.current ? 'bg-faint' : 'bg-border-strong',
              )}
            />
          </div>
        ))}
      </div>
      <WeekLabels weeks={weeks} ticks={false} />
    </div>
  );
}
