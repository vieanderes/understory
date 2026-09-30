import { cn } from '@/lib/cn';

interface LabFrameProps {
  /** Shown when the lab stands alone. Inside a lesson the step provides the heading. */
  title?: string;
  question?: string;
  /** The transport: step, play, reset, speed. Always above the stage, never floating. */
  controls: React.ReactNode;
  /** One line that says what just happened, announced to screen readers. */
  status: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * The shared frame of every lab: controls, the stage, a status line. Labs differ in what
 * they simulate, not in how they are operated, so that learning one lab's controls is
 * learning them all.
 */
export function LabFrame({
  title,
  question,
  controls,
  status,
  children,
  className,
}: LabFrameProps) {
  return (
    <section aria-label={title ?? 'Lab'} className={cn('flex flex-col gap-2', className)}>
      {title ? (
        <header className="flex flex-col gap-1">
          <p className="t-label">Lab</p>
          <h1 className="t-section">{title}</h1>
          {question ? <p className="text-muted prose-measure">{question}</p> : null}
        </header>
      ) : null}
      <div className="rule-t flex flex-wrap items-center gap-1 pt-2">{controls}</div>
      <div className="border-border bg-surface rounded-panel min-w-0 border p-2">{children}</div>
      <p role="status" className="text-muted min-h-3 text-sm">
        {status}
      </p>
    </section>
  );
}
