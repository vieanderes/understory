import { px, trackListCss, type ResolvedTrack, type Track } from '@/core/labs/flex-grid-playground';
import { cn } from '@/lib/cn';

interface GridStageProps {
  containerWidth: number;
  gap: number;
  tracks: readonly Track[];
  itemCount: number;
  /** Predicted track sizes, shown along the ruler above the grid. */
  resolved: readonly ResolvedTrack[];
  /** Tracks this step is about. They carry the accent. */
  active: readonly number[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Wraps one `width: max-content` probe per item, in the same order. */
  probesRef: React.RefObject<HTMLDivElement | null>;
}

/** Enough names for the largest grid the controls allow. */
export const ITEM_TEXT = ['Sunrise', 'Harbour', 'Forest', 'Bridge', 'Market', 'Snow'] as const;

const ITEM =
  'border-border bg-sunken rounded-inner t-figure flex min-w-0 items-center justify-center overflow-hidden border px-1 py-0.5 text-sm whitespace-nowrap';

export function GridStage({
  containerWidth,
  gap,
  tracks,
  itemCount,
  resolved,
  active,
  containerRef,
  probesRef,
}: GridStageProps) {
  const template = trackListCss(tracks);
  const items = Array.from({ length: itemCount }, (_, index) => index);

  return (
    <div tabIndex={0} role="group" aria-label="Grid stage" className="min-w-0 overflow-x-auto pb-1">
      <div className="relative flex w-fit flex-col gap-1">
        <p className="t-figure text-muted text-sm">grid-template-columns: {template}</p>
        {/* Outline, not border: a border would take two pixels out of the container's
            content box, and every track would resolve against the wrong width. */}
        <div
          ref={containerRef}
          data-testid="grid-container"
          className="bg-bg outline-border grid outline-1"
          style={{ width: containerWidth, gap, gridTemplateColumns: template }}
        >
          {items.map((index) => (
            <div key={index} data-testid={`item-${index}`} className={ITEM}>
              {ITEM_TEXT[index % ITEM_TEXT.length]}
            </div>
          ))}
        </div>
        {/* The ruler is laid out from the prediction, so it lines up with the grid above
            only while the prediction holds. A collapsed auto-fit track takes its gap with
            it and is left out here, as it is on the stage. */}
        <div aria-hidden className="flex" style={{ width: containerWidth, gap }}>
          {resolved
            .map((track, index) => ({ track, index }))
            .filter((entry) => !entry.track.collapsed)
            .map((entry) => (
              <div
                key={entry.index}
                className={cn(
                  't-figure shrink-0 overflow-hidden text-center text-sm',
                  active.includes(entry.index) ? 'text-accent' : 'text-muted',
                )}
                style={{ width: entry.track.size }}
              >
                {px(entry.track.size)}
              </div>
            ))}
        </div>
        <div
          ref={probesRef}
          aria-hidden
          className="pointer-events-none invisible absolute top-0 left-0"
        >
          {items.map((index) => (
            <div key={`probe-${index}`} className={cn(ITEM, 'w-max')}>
              {ITEM_TEXT[index % ITEM_TEXT.length]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
