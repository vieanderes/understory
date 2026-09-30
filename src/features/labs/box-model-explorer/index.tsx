'use client';

import { ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  SCENARIOS,
  boxSize,
  px,
  run,
  scenarioById,
  stackLayout,
  type BoxInput,
  type ParentKind,
  type Scenario,
  type ScenarioId,
  type StackInput,
} from '@/core/labs/box-model-explorer';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { NumberField } from '../parts/NumberField';
import { PredictionTable, type PredictionRow } from '../parts/PredictionTable';
import { Transport } from '../parts/Transport';
import { useLayoutMeasure } from '../parts/useLayoutMeasure';
import { usePlayback } from '../parts/usePlayback';
import { BoxStage } from './BoxStage';
import { Choice } from './Choice';
import { PARENT_CSS, StackStage } from './StackStage';
import { RANGE, startFrom } from './preset';

const TITLE = 'Box model explorer';
const QUESTION =
  'How wide is this box on screen, and why is the gap between two blocks smaller than the sum of their margins?';

const SIZING_OPTIONS = [
  { value: 'content-box', label: 'content-box' },
  { value: 'border-box', label: 'border-box' },
] as const;

const UNIT_OPTIONS = [
  { value: 'px', label: 'px' },
  { value: 'percent', label: '% of the container' },
] as const;

const PARENT_OPTIONS = (Object.keys(PARENT_CSS) as ParentKind[]).map((kind) => ({
  value: kind,
  label: PARENT_CSS[kind],
}));

const LEFT_OUT = [
  'One figure per property, the same on all four sides. Real boxes set each side on its own, and a percentage margin also resolves against the width of the containing block.',
  'Widths in percentages, min-width and max-width, and the auto width that fills the containing block.',
  'Margin collapse here is two siblings and a first child. Collapse through an empty block, collapse with a parent bottom edge, and collapse past clearance are left out.',
  'Nothing floats, nothing is absolutely positioned, and nothing scrolls, so no scrollbar takes width from the content box.',
  'One writing mode: horizontal, left to right. In vertical writing, percentage padding resolves against the inline size, which is then the height.',
];

/** What the browser reports for the box scenario, read after every commit. */
interface BoxMeasured {
  kind: 'box';
  padding: number;
  contentWidth: number;
  contentHeight: number;
  borderWidth: number;
  borderHeight: number;
  marginWidth: number;
  marginHeight: number;
}

interface StackMeasured {
  kind: 'stack';
  gap: number;
  childOffset: number;
  parentOffset: number;
}

type Measured = BoxMeasured | StackMeasured;

function Arithmetic({
  lines,
}: {
  lines: readonly { label: string; expression: string; result: string }[];
}) {
  if (lines.length === 0) return <p className="text-muted text-sm">Step to work it out.</p>;
  return (
    <dl className="flex flex-col">
      {lines.map((line) => (
        <div
          key={`${line.label} ${line.expression}`}
          className="rule-b flex flex-wrap items-baseline justify-between gap-x-1 py-0.5"
        >
          <dt className="text-sm">{line.label}</dt>
          <dd className="t-figure text-sm">
            {line.expression} = <span className="font-medium">{line.result}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function BoxModelExplorerLab({ preset, embedded }: LabProps) {
  const [start] = useState(() => startFrom(preset));
  const [scenarioId, setScenarioId] = useState<ScenarioId>(start.scenario.id);
  const [box, setBox] = useState<BoxInput>(start.box);
  const [stack, setStack] = useState<StackInput>(start.stack);
  const [revealedByHand, setRevealedByHand] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const actARef = useRef<HTMLDivElement>(null);
  const actBRef = useRef<HTMLDivElement>(null);

  const scenario = scenarioById(scenarioId);
  const live: Scenario = scenario.kind === 'box' ? { ...scenario, box } : { ...scenario, stack };
  const frames = run(live);
  const playback = usePlayback(frames.length);
  const frame = frames[playback.index]!;
  const last = frames[frames.length - 1]!;
  const revealed = revealedByHand || frame.revealed;

  // The browser is the source of truth: the engine predicts, this reads what happened.
  const measured = useLayoutMeasure<Measured>(() => {
    const element = boxRef.current;
    const content = contentRef.current;
    if (element && content) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const inner = content.getBoundingClientRect();
      const margin = Number.parseFloat(style.marginTop) || 0;
      return {
        kind: 'box',
        padding: Number.parseFloat(style.paddingTop) || 0,
        contentWidth: inner.width,
        contentHeight: inner.height,
        borderWidth: rect.width,
        borderHeight: rect.height,
        marginWidth: rect.width + 2 * margin,
        marginHeight: rect.height + 2 * margin,
      };
    }
    const stageElement = stageRef.current;
    const parent = parentRef.current;
    const actA = actARef.current;
    const actB = actBRef.current;
    if (!stageElement || !parent || !actA || !actB) return null;
    const a = actA.getBoundingClientRect();
    const b = actB.getBoundingClientRect();
    const parentTop = parent.getBoundingClientRect().top;
    return {
      kind: 'stack',
      gap: b.top - a.bottom,
      childOffset: a.top - parentTop,
      parentOffset: parentTop - stageElement.getBoundingClientRect().top,
    };
  });

  const boxResult = boxSize(box);
  const stackResult = stackLayout(stack);
  const boxSeen = measured?.kind === 'box' ? measured : null;
  const stackSeen = measured?.kind === 'stack' ? measured : null;

  const rows: PredictionRow[] =
    scenario.kind === 'box'
      ? [
          { label: 'Padding', predicted: boxResult.padding, measured: boxSeen?.padding ?? null },
          {
            label: 'Content width',
            predicted: boxResult.content.width,
            measured: boxSeen?.contentWidth ?? null,
          },
          {
            label: 'Content height',
            predicted: boxResult.content.height,
            measured: boxSeen?.contentHeight ?? null,
          },
          {
            label: 'Border box width',
            predicted: boxResult.borderBox.width,
            measured: boxSeen?.borderWidth ?? null,
          },
          {
            label: 'Border box height',
            predicted: boxResult.borderBox.height,
            measured: boxSeen?.borderHeight ?? null,
          },
          {
            label: 'Margin box width',
            predicted: boxResult.marginBox.width,
            measured: boxSeen?.marginWidth ?? null,
          },
        ]
      : [
          {
            label: 'Gap between paragraphs',
            predicted: stackResult.gap,
            measured: stackSeen?.gap ?? null,
          },
          {
            label: 'First paragraph inside parent',
            predicted: stackResult.childOffset,
            measured: stackSeen?.childOffset ?? null,
          },
          {
            label: 'Parent below the stage top',
            predicted: stackResult.parentOffset,
            measured: stackSeen?.parentOffset ?? null,
          },
        ];

  const chooseScenario = (id: string) => {
    const next = scenarioById(id as ScenarioId);
    setScenarioId(next.id);
    if (next.kind === 'box') setBox(next.box);
    else setStack(next.stack);
    setRevealedByHand(false);
    playback.reset();
  };

  const status = revealedByHand && !frame.revealed ? last.status : frame.status;

  return (
    <LabFrame
      title={embedded ? undefined : TITLE}
      question={embedded ? undefined : QUESTION}
      controls={
        <>
          <Transport
            canBack={playback.canBack}
            canForward={playback.canForward}
            playing={playback.playing}
            onBack={playback.back}
            onForward={playback.forward}
            onPlayPause={playback.playPause}
            onReset={playback.reset}
            position={playback.position}
          />
          <Button size="md" onClick={() => setRevealedByHand(true)} disabled={revealed}>
            Reveal
          </Button>
        </>
      }
      status={status}
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 md:grid-cols-12 md:gap-x-4">
          {start.hideSwitcher ? null : (
            <Choice
              label="Scenario"
              value={scenarioId}
              options={SCENARIOS.map((item) => ({ value: item.id, label: item.label }))}
              onChange={chooseScenario}
              className="md:col-span-4"
            />
          )}
          <p className="prose-measure font-medium md:col-span-8">{scenario.prompt}</p>
        </div>

        {scenario.kind === 'box' ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-12 md:gap-x-4">
            <NumberField
              label="Width"
              unit="px"
              value={box.width}
              onChange={(width) => setBox((current) => ({ ...current, width }))}
              min={RANGE.width.min}
              max={RANGE.width.max}
              step={4}
              className="md:col-span-2"
            />
            <NumberField
              label="Height"
              unit="px"
              value={box.height}
              onChange={(height) => setBox((current) => ({ ...current, height }))}
              min={RANGE.height.min}
              max={RANGE.height.max}
              step={4}
              className="md:col-span-2"
            />
            <NumberField
              label="Padding"
              unit={box.paddingUnit === 'percent' ? '%' : 'px'}
              value={box.padding}
              onChange={(padding) => setBox((current) => ({ ...current, padding }))}
              min={RANGE.padding.min}
              max={RANGE.padding.max}
              step={2}
              className="md:col-span-2"
            />
            <Choice
              label="Padding unit"
              value={box.paddingUnit}
              options={UNIT_OPTIONS}
              onChange={(paddingUnit) => setBox((current) => ({ ...current, paddingUnit }))}
              className="col-span-2 md:col-span-2"
            />
            <NumberField
              label="Border"
              unit="px"
              value={box.border}
              onChange={(border) => setBox((current) => ({ ...current, border }))}
              min={RANGE.border.min}
              max={RANGE.border.max}
              className="md:col-span-2"
            />
            <NumberField
              label="Margin"
              unit="px"
              value={box.margin}
              onChange={(margin) => setBox((current) => ({ ...current, margin }))}
              min={RANGE.margin.min}
              max={RANGE.margin.max}
              step={4}
              className="md:col-span-2"
            />
            <Choice
              label="box-sizing"
              value={box.boxSizing}
              options={SIZING_OPTIONS}
              onChange={(boxSizing) => setBox((current) => ({ ...current, boxSizing }))}
              className="col-span-2 md:col-span-4"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-12 md:gap-x-4">
            <NumberField
              label="Above the first paragraph"
              unit="px"
              value={stack.marginTopA}
              onChange={(marginTopA) => setStack((current) => ({ ...current, marginTopA }))}
              min={RANGE.actMargin.min}
              max={RANGE.actMargin.max}
              step={4}
              className="md:col-span-3"
            />
            <NumberField
              label="Below the first paragraph"
              unit="px"
              value={stack.marginBottomA}
              onChange={(marginBottomA) => setStack((current) => ({ ...current, marginBottomA }))}
              min={RANGE.actMargin.min}
              max={RANGE.actMargin.max}
              step={4}
              className="md:col-span-3"
            />
            <NumberField
              label="Above the second paragraph"
              unit="px"
              value={stack.marginTopB}
              onChange={(marginTopB) => setStack((current) => ({ ...current, marginTopB }))}
              min={RANGE.actMargin.min}
              max={RANGE.actMargin.max}
              step={4}
              className="md:col-span-3"
            />
            <Choice
              label="Parent"
              value={stack.parent}
              options={PARENT_OPTIONS}
              onChange={(parent) => setStack((current) => ({ ...current, parent }))}
              className="col-span-2 md:col-span-3"
            />
            <NumberField
              label="Parent padding"
              unit="px"
              value={stack.parentPadding}
              onChange={(parentPadding) => setStack((current) => ({ ...current, parentPadding }))}
              min={RANGE.parentPadding.min}
              max={RANGE.parentPadding.max}
              step={4}
              disabled={stack.parent !== 'padding'}
              className="md:col-span-3"
            />
            <NumberField
              label="Parent border"
              unit="px"
              value={stack.parentBorder}
              onChange={(parentBorder) => setStack((current) => ({ ...current, parentBorder }))}
              min={RANGE.parentBorder.min}
              max={RANGE.parentBorder.max}
              step={2}
              disabled={stack.parent !== 'border'}
              className="md:col-span-3"
            />
          </div>
        )}

        <div className="rule-t grid gap-3 pt-2 md:grid-cols-12 md:gap-x-4">
          <div className="min-w-0 md:col-span-7">
            {scenario.kind === 'box' ? (
              <BoxStage
                box={box}
                result={boxResult}
                focus={frame.focus}
                stageRef={stageRef}
                boxRef={boxRef}
                contentRef={contentRef}
              />
            ) : (
              <StackStage
                stack={stack}
                result={stackResult}
                focus={frame.focus}
                stageRef={stageRef}
                parentRef={parentRef}
                actARef={actARef}
                actBRef={actBRef}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2 md:col-span-5">
            <PredictionTable
              caption={revealed ? 'Prediction against the browser' : 'Predict, then reveal'}
              rows={rows}
              revealed={revealed}
              format={px}
            />
            <div className="flex flex-col gap-1">
              <p className="t-label">Arithmetic</p>
              <Arithmetic lines={revealed ? last.arithmetic : frame.arithmetic} />
            </div>
          </div>
        </div>

        <details className="group rule-t">
          <summary className="t-label flex min-h-5 cursor-pointer items-center gap-1">
            <ChevronRight
              aria-hidden
              size={16}
              strokeWidth={2}
              className="transition-transform duration-150 ease-out group-open:rotate-90"
            />
            What this leaves out
          </summary>
          <div className="flex flex-col gap-1 pb-1 text-sm">
            <p className="text-muted prose-measure">
              The stage is a real element with real CSS, so what it measures is the truth. The
              arithmetic beside it is the prediction, and it covers less than the specification
              does:
            </p>
            <ul className="prose-measure list-disc pl-3">
              {LEFT_OUT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </LabFrame>
  );
}
