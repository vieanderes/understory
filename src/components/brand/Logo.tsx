import { cn } from '@/lib/cn';

/**
 * The mark: three strata. Canopy, understory, forest floor. The middle layer, the one
 * beneath the surface, carries the accent. It reads at 16 px and needs no gradient.
 */
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        className="mark-stroke"
        pathLength={1}
        d="M7 5.5h10"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        className="mark-stroke"
        pathLength={1}
        d="M3 12h18"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        className="mark-stroke"
        pathLength={1}
        d="M5 18.5h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Mark />
      <span className="font-display text-lg tracking-tight">Understory</span>
    </span>
  );
}
