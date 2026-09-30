import type { FlexItem } from '@/core/labs/flex-grid-playground';
import { cn } from '@/lib/cn';

interface FlexStageProps {
  containerWidth: number;
  gap: number;
  items: readonly FlexItem[];
  /** Items this step is about. They carry the accent. */
  active: readonly number[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Wraps one `width: min-content` probe per item, in the same order. */
  probesRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The item and its probe carry the same classes, so the probe's `width: min-content` is
 * the item's content-based minimum: what `min-width: auto` resolves to (CSS Flexbox 1
 * section 4.5). The text does not wrap, so that minimum is the whole line.
 */
const ITEM =
  'border-border bg-sunken rounded-inner t-figure flex items-center justify-center border px-1 py-0.5 text-sm whitespace-nowrap';

export function FlexStage({
  containerWidth,
  gap,
  items,
  active,
  containerRef,
  probesRef,
}: FlexStageProps) {
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Flex row stage"
      className="min-w-0 overflow-x-auto pb-1"
    >
      <div className="relative w-fit">
        {/* Outline, not border: a border would take two pixels out of the container's
            content box, and the free space would be two pixels short. */}
        <div
          ref={containerRef}
          data-testid="flex-container"
          className="bg-bg outline-border flex outline-1"
          style={{ width: containerWidth, gap }}
        >
          {items.map((item, index) => (
            <div
              key={item.label}
              data-testid={`item-${index}`}
              className={cn(ITEM, active.includes(index) && 'border-accent text-accent')}
              style={{
                flexGrow: item.grow,
                flexShrink: item.shrink,
                flexBasis: `${item.basis}px`,
                minWidth: item.minWidth === 'auto' ? 'auto' : `${item.minWidth}px`,
              }}
            >
              {item.text}
            </div>
          ))}
        </div>
        <div
          ref={probesRef}
          aria-hidden
          className="pointer-events-none invisible absolute top-0 left-0"
        >
          {items.map((item) => (
            <div key={item.label} className={cn(ITEM, 'w-min')}>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
