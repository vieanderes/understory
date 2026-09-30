import type { StrategyInfo } from '@/core/labs/overselling-simulator';
import { cn } from '@/lib/cn';

interface SketchProps {
  info: StrategyInfo;
  /** Index into `info.sketch` of the line the current step is running. */
  activeLine: number | null;
  /** Who is running it. */
  actor: string | null;
  className?: string;
}

const VERDICT: Record<StrategyInfo['verdict'], string> = {
  holds: 'sold <= capacity survives every interleaving',
  breaks: 'sold <= capacity breaks under some interleavings',
};

/**
 * The strategy as the code it stands for, with the line the current actor is on marked.
 * Reading the race means reading the gap between two of these lines, so the code is the
 * first thing on the page, above the timeline.
 */
export function Sketch({ info, activeLine, actor, className }: SketchProps) {
  return (
    <section aria-label="Strategy" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <h2 className="t-label">Strategy</h2>
      <p className="font-medium">{info.title}</p>
      <p className="t-label">{VERDICT[info.verdict]}</p>
      <ol className="border-border bg-bg rounded-control border p-1 font-mono text-sm">
        {info.sketch.map((line, index) => {
          const active = index === activeLine;
          const heading = line.routine && line.routine !== info.sketch[index - 1]?.routine;
          return (
            <li key={line.code} className="min-w-0">
              {heading ? <p className="t-label pt-1">{`${line.routine}()`}</p> : null}
              <span
                data-line={index}
                data-active={active || undefined}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'code-line rounded-inner px-0.5',
                  active ? 'bg-accent-tint' : undefined,
                )}
              >
                <span aria-hidden className="text-faint">
                  {index + 1}
                </span>
                <span className="min-w-0 break-words whitespace-pre-wrap">
                  {line.code}
                  {active && actor ? (
                    <span className="t-label text-accent pl-1">{actor} is here</span>
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-muted prose-measure text-sm">{info.summary}</p>
    </section>
  );
}
