import { cn } from '@/lib/cn';

/**
 * Scout's mark: a cairn, the stack of stones a scout leaves on a trail so the people behind
 * find the way. It is the Understory strata turned into stones: flat, stacked, the top one
 * in the accent because it is the hint. While Scout thinks, the stones stack themselves
 * (motion.css, `.scout-thinking`). The groups carry the motion so the middle stone keeps
 * its hand-stacked tilt.
 */
export function ScoutMark({
  size = 16,
  thinking = false,
  className,
}: {
  size?: number;
  thinking?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('shrink-0 overflow-visible', thinking && 'scout-thinking', className)}
    >
      <g className="scout-stone">
        <rect x="2.5" y="16" width="19" height="5.5" rx="2.75" fill="currentColor" />
      </g>
      <g className="scout-stone">
        <rect
          x="5"
          y="10"
          width="12.5"
          height="4.75"
          rx="2.375"
          fill="currentColor"
          transform="rotate(-5 11.25 12.4)"
        />
      </g>
      <g className="scout-stone">
        <rect x="10.5" y="4" width="7" height="4.5" rx="2.25" fill="var(--accent)" />
      </g>
    </svg>
  );
}
