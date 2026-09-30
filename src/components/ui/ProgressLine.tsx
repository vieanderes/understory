import { cn } from '@/lib/cn';

interface ProgressLineProps {
  /** 0..1. */
  value: number;
  /** Read by a screen reader in place of the line, for example "3 of 23 lessons done". */
  label: string;
  className?: string;
}

/**
 * How far through one stretch of the course. Ink on a hairline, never the accent: progress
 * is information, not the thing to press. The line draws in when it arrives, and the fill
 * grows with a short transform. Reduced motion removes both.
 */
export function ProgressLine({ value, label, className }: ProgressLineProps) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      data-arrive="draw"
      className={cn('bg-border h-0.5 w-full overflow-hidden rounded-full', className)}
    >
      <div
        className="bg-fg h-full origin-left rounded-full transition-transform duration-200 ease-out"
        style={{ transform: `scaleX(${clamped})` }}
      />
    </div>
  );
}
