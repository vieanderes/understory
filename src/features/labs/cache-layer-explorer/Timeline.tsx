import { eventText, type Scenario } from '@/core/labs/cache-layer-explorer';
import { cn } from '@/lib/cn';

interface TimelineProps {
  scenario: Scenario;
  /** Frame index: 0 is before anything ran, so `index - 1` is the event just taken. */
  index: number;
  className?: string;
}

/** The whole plan, with the step just taken marked. Nothing here is a surprise. */
export function Timeline({ scenario, index, className }: TimelineProps) {
  return (
    <section aria-label="What happens" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <h2 className="t-label">What happens</h2>
      <ol className="flex min-w-0 flex-col">
        {scenario.timeline.map((event, at) => {
          const current = at === index - 1;
          const done = at < index - 1;
          return (
            <li
              key={`${at}-${event.kind}`}
              aria-current={current ? 'step' : undefined}
              data-testid="timeline-step"
              className={cn(
                'flex min-w-0 items-baseline gap-1 py-0.5 text-sm',
                current && 'bg-accent-tint',
                !current && !done && 'text-muted',
              )}
            >
              <span className="t-label t-figure shrink-0 px-0.5">{at + 1}</span>
              <span className={cn('min-w-0', current && 'font-medium')}>
                {eventText(scenario, event)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
