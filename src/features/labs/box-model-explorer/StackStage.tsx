import {
  CONTAINER_WIDTH,
  px,
  type Focus,
  type ParentKind,
  type StackInput,
  type StackResult,
} from '@/core/labs/box-model-explorer';
import { cn } from '@/lib/cn';

interface StackStageProps {
  stack: StackInput;
  result: StackResult;
  focus: Focus;
  stageRef: React.RefObject<HTMLDivElement | null>;
  parentRef: React.RefObject<HTMLDivElement | null>;
  actARef: React.RefObject<HTMLDivElement | null>;
  actBRef: React.RefObject<HTMLDivElement | null>;
}

/** The parent's own CSS. Display comes from a class, the two lengths from the scenario. */
const PARENT_DISPLAY: Record<ParentKind, string> = {
  plain: '',
  padding: '',
  border: '',
  'flow-root': 'flow-root',
  flex: 'flex flex-col',
  grid: 'grid',
};

export const PARENT_CSS: Record<ParentKind, string> = {
  plain: 'display: block',
  padding: 'padding on the parent',
  border: 'border on the parent',
  'flow-root': 'display: flow-root',
  flex: 'display: flex',
  grid: 'display: grid',
};

const PARAGRAPH =
  'border-border bg-surface rounded-inner t-figure flex h-5 items-center border px-1 text-sm';

/**
 * Two blocks in a parent, laid out by the browser. The gap between them is the collapsed
 * margin, and how far the first one sits from the parent's edge says whether the parent
 * and its first child collapsed too.
 */
export function StackStage({
  stack,
  result,
  focus,
  stageRef,
  parentRef,
  actARef,
  actBRef,
}: StackStageProps) {
  const rows = [
    { label: 'Gap between paragraphs', figure: px(result.gap), active: focus === 'siblings' },
    {
      label: 'First paragraph inside parent',
      figure: px(result.childOffset),
      active: focus === 'parent',
    },
    {
      label: 'Parent below the stage top',
      figure: px(result.parentOffset),
      active: focus === 'parent',
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div
        tabIndex={0}
        role="group"
        aria-label="Margin collapse stage"
        className="min-w-0 overflow-x-auto pb-1"
      >
        <div className="flex flex-col gap-1">
          <p className="t-label">In the browser · {PARENT_CSS[stack.parent]}</p>
          {/* Outline, not border: the stage is the origin every offset is measured from. */}
          <div
            ref={stageRef}
            className="bg-bg outline-border flow-root outline-1"
            style={{ width: CONTAINER_WIDTH }}
          >
            <div
              ref={parentRef}
              data-testid="parent"
              className={cn('border-border bg-sunken', PARENT_DISPLAY[stack.parent])}
              style={{
                padding: stack.parent === 'padding' ? stack.parentPadding : undefined,
                borderWidth: stack.parent === 'border' ? stack.parentBorder : undefined,
              }}
            >
              <div
                ref={actARef}
                data-testid="paragraph-a"
                className={PARAGRAPH}
                style={{ marginTop: stack.marginTopA, marginBottom: stack.marginBottomA }}
              >
                First paragraph
              </div>
              <div
                ref={actBRef}
                data-testid="paragraph-b"
                className={PARAGRAPH}
                style={{ marginTop: stack.marginTopB }}
              >
                Second paragraph
              </div>
            </div>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-2">
        {rows.map((row) => (
          <div key={row.label} className="rule-b flex items-baseline justify-between gap-1 py-0.5">
            <dt className={cn('t-label', row.active && 'text-accent')}>{row.label}</dt>
            <dd className={cn('t-figure text-sm', row.active && 'text-accent')}>{row.figure}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
