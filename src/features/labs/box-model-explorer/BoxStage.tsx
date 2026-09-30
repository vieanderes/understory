import { px, type BoxInput, type BoxResult, type Focus } from '@/core/labs/box-model-explorer';
import { cn } from '@/lib/cn';

interface BoxStageProps {
  box: BoxInput;
  result: BoxResult;
  focus: Focus;
  stageRef: React.RefObject<HTMLDivElement | null>;
  boxRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const size = (width: number, height: number) => `${px(width)} × ${px(height)}`;

/**
 * The classic nested diagram, drawn from the prediction: content inside padding inside
 * border inside margin. Every length is inline geometry computed from the engine; the
 * colours are tokens. The layer this step is about carries the accent.
 */
function Diagram({ box, result, focus }: Pick<BoxStageProps, 'box' | 'result' | 'focus'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'border-border w-fit border border-dashed',
        focus === 'margin' && 'border-accent',
      )}
      style={{ padding: box.margin }}
    >
      <div
        className={cn('border-border', focus === 'border' && 'border-accent')}
        style={{ borderWidth: box.border }}
      >
        <div
          className={cn('bg-sunken', focus === 'padding' && 'bg-accent-tint')}
          style={{ padding: result.padding }}
        >
          <div
            className={cn(
              'border-border bg-surface flex items-center justify-center overflow-hidden border',
              focus === 'content' && 'border-accent',
            )}
            style={{ width: result.content.width, height: result.content.height }}
          >
            <span className="t-figure text-muted text-sm">
              {size(result.content.width, result.content.height)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LegendRow {
  label: string;
  figure: string;
  active: boolean;
}

function Legend({ rows }: { rows: readonly LegendRow[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-2">
      {rows.map((row) => (
        <div key={row.label} className="rule-b flex items-baseline justify-between gap-1 py-0.5">
          <dt className={cn('t-label', row.active && 'text-accent')}>{row.label}</dt>
          <dd className={cn('t-figure text-sm', row.active && 'text-accent')}>{row.figure}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The prediction beside the element the browser actually lays out and we then measure. */
export function BoxStage({ box, result, focus, stageRef, boxRef, contentRef }: BoxStageProps) {
  const rows: LegendRow[] = [
    {
      label: 'Content',
      figure: size(result.content.width, result.content.height),
      active: focus === 'content',
    },
    {
      label: 'Padding',
      figure:
        box.paddingUnit === 'percent'
          ? `${px(result.padding)} (${px(box.padding)}%)`
          : px(result.padding),
      active: focus === 'padding',
    },
    { label: 'Border', figure: px(box.border), active: focus === 'border' },
    { label: 'Margin', figure: px(box.margin), active: focus === 'margin' },
    {
      label: 'Rendered total',
      figure: size(result.borderBox.width, result.borderBox.height),
      active: focus === 'border' || focus === 'measured',
    },
    {
      label: 'Room taken',
      figure: size(result.marginBox.width, result.marginBox.height),
      active: focus === 'margin',
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div
        tabIndex={0}
        role="group"
        aria-label="Box model stage"
        className="min-w-0 overflow-x-auto pb-1"
      >
        <div className="flex w-fit items-start gap-2">
          <div className="flex flex-col gap-1">
            <p className="t-label">Predicted</p>
            <Diagram box={box} result={result} focus={focus} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="t-label">In the browser</p>
            {/* Outline, not border: a border would come out of the 320 px content box,
                and percentage padding and the free space would resolve against 318. */}
            <div
              ref={stageRef}
              className="bg-bg outline-border flow-root outline-1"
              style={{ width: box.containerWidth }}
            >
              <div
                ref={boxRef}
                data-testid="box"
                className="border-border bg-sunken"
                style={{
                  width: box.width,
                  height: box.height,
                  padding: box.paddingUnit === 'percent' ? `${box.padding}%` : `${box.padding}px`,
                  borderWidth: box.border,
                  margin: box.margin,
                  boxSizing: box.boxSizing,
                }}
              >
                <div
                  ref={contentRef}
                  className="bg-surface h-full w-full overflow-hidden"
                  data-testid="content"
                >
                  <span className="t-figure text-muted text-sm">content</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Legend rows={rows} />
    </div>
  );
}
