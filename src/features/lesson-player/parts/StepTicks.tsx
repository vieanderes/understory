import { cn } from '@/lib/cn';

export type TickState = 'todo' | 'current' | 'right' | 'wrong' | 'done';

const TICK: Record<TickState, string> = {
  todo: 'bg-border',
  current: 'bg-fg',
  right: 'bg-success',
  wrong: 'bg-accent',
  done: 'bg-muted',
};

/** One tick per step. Where you are, how far there is to go, and how it went so far. */
export function StepTicks({ ticks, label }: { ticks: readonly TickState[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-1 flex-1 items-center gap-0.5">
      {ticks.map((state, i) => (
        <span
          key={i}
          className={cn(
            'h-0.5 flex-1 rounded-full transition-colors duration-150 ease-out',
            TICK[state],
            state === 'right' && 'tick-fill',
          )}
        />
      ))}
    </div>
  );
}
