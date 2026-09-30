'use client';

import { ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  SCENARIOS,
  px,
  resolveFlex,
  resolveTracks,
  run,
  scenarioById,
  type FlexItem,
  type Scenario,
  type ScenarioId,
  type Track,
} from '@/core/labs/flex-grid-playground';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { NumberField } from '../parts/NumberField';
import { PredictionTable, type PredictionRow } from '../parts/PredictionTable';
import { Transport } from '../parts/Transport';
import { useLayoutMeasure } from '../parts/useLayoutMeasure';
import { usePlayback } from '../parts/usePlayback';
import { Choice } from './Choice';
import { FlexStage } from './FlexStage';
import { GridStage } from './GridStage';
import { TrackControls } from './TrackControls';
import { RANGE, startFrom, type FlexState, type GridState } from './preset';

const TITLE = 'Flex and grid playground';
const QUESTION =
  'Where does the space left over in a row go, and why does one item refuse to shrink?';

const MIN_WIDTH_OPTIONS = [
  { value: 'auto', label: 'auto' },
  { value: 'px', label: 'px' },
] as const;

const LEFT_OUT = [
  'One flex line. Wrapping, max-width, auto margins and alignment other than stretch are left out, so the only violations the algorithm meets are minimum violations.',
  'flex-basis is always a length here. The values auto and content, which read the item’s own width or its content, are left out. Every item has 18 px of padding and border, inside box-sizing: border-box.',
  'Grid intrinsic sizing is simplified. An auto track is taken at the max-content width measured in the browser and is never squeezed below it, nothing spans more than one column, and items are placed one per column in order.',
  'Every item on the grid stage carries min-width: 0, so an fr track can shrink past its content. Without it a grid item’s automatic minimum would hold the track open, as it does for a flex item.',
  'fit-content(), named lines and areas, explicit placement, row sizing and justify-content other than normal are left out.',
  'Browsers lay out in 1/64 px, so prediction and measurement agree to within half a pixel rather than exactly.',
];

interface Measured {
  kind: 'flex' | 'grid';
  /** min-content per flex item, or max-content per grid item, in order. */
  probes: number[];
  /** Item widths for flex, resolved track sizes for grid. */
  sizes: number[];
}

function Arithmetic({
  lines,
}: {
  lines: readonly { label: string; expression: string; result: string }[];
}) {
  if (lines.length === 0) return <p className="text-muted text-sm">Step to work it out.</p>;
  return (
    <dl className="flex flex-col">
      {lines.map((line, index) => (
        <div
          key={`${index} ${line.label}`}
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

const widths = (elements: HTMLCollection) =>
  Array.from(elements, (element) => element.getBoundingClientRect().width);

export default function FlexGridPlaygroundLab({ preset, embedded }: LabProps) {
  const [start] = useState(() => startFrom(preset));
  const [scenarioId, setScenarioId] = useState<ScenarioId>(start.scenario.id);
  const [flex, setFlex] = useState<FlexState>(start.flex);
  const [grid, setGrid] = useState<GridState>(start.grid);
  const [revealedByHand, setRevealedByHand] = useState(false);

  const flexRef = useRef<HTMLDivElement>(null);
  const flexProbesRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridProbesRef = useRef<HTMLDivElement>(null);

  // The browser is the source of truth. The probes give the engine the two content sizes
  // it never computes: a flex item's min-content width and an auto track's max-content.
  const measured = useLayoutMeasure<Measured>(() => {
    const flexContainer = flexRef.current;
    const flexProbes = flexProbesRef.current;
    if (flexContainer && flexProbes)
      return {
        kind: 'flex',
        probes: widths(flexProbes.children),
        sizes: widths(flexContainer.children),
      };
    const gridContainer = gridRef.current;
    const gridProbes = gridProbesRef.current;
    if (!gridContainer || !gridProbes) return null;
    const template = window.getComputedStyle(gridContainer).gridTemplateColumns;
    return {
      kind: 'grid',
      probes: widths(gridProbes.children),
      // The used track sizes, in order, including a collapsed auto-fit track at 0.
      sizes: template
        .split(/\s+/)
        .flatMap((part) => (part.endsWith('px') ? [Number.parseFloat(part)] : [])),
    };
  });

  const probe = (index: number) => measured?.probes[index] ?? 0;
  const items: FlexItem[] = flex.items.map((item, index) =>
    item.minWidth === 'auto' ? { ...item, minContent: probe(index) } : item,
  );
  const tracks: Track[] = grid.tracks.map((track, index) =>
    track.kind === 'auto' ? { ...track, content: probe(index) } : track,
  );

  const scenario = scenarioById(scenarioId);
  const live: Scenario =
    scenario.kind === 'flex'
      ? { ...scenario, containerWidth: flex.containerWidth, gap: flex.gap, items }
      : {
          ...scenario,
          containerWidth: grid.containerWidth,
          gap: grid.gap,
          tracks,
          itemCount: grid.itemCount,
        };
  const frames = run(live);
  const playback = usePlayback(frames.length);
  const frame = frames[playback.index]!;
  const last = frames[frames.length - 1]!;
  const revealed = revealedByHand || frame.revealed;

  const flexResult = resolveFlex(flex.containerWidth, items, flex.gap);
  const gridResult = resolveTracks(grid.containerWidth, grid.gap, tracks, grid.itemCount);
  const seen = measured?.kind === scenario.kind ? measured : null;

  const rows: PredictionRow[] =
    scenario.kind === 'flex'
      ? items.map((item, index) => ({
          label: item.label,
          predicted: flexResult.sizes[index] ?? 0,
          measured: seen?.sizes[index] ?? null,
        }))
      : gridResult.tracks.map((track, index) => ({
          label: `Column ${index + 1}`,
          predicted: track.size,
          measured: seen?.sizes[index] ?? null,
        }));

  const chooseScenario = (id: string) => {
    const next = scenarioById(id as ScenarioId);
    setScenarioId(next.id);
    if (next.kind === 'flex')
      setFlex({ containerWidth: next.containerWidth, gap: next.gap, items: next.items });
    else
      setGrid({
        containerWidth: next.containerWidth,
        gap: next.gap,
        tracks: next.tracks,
        itemCount: next.itemCount,
      });
    setRevealedByHand(false);
    playback.reset();
  };

  const setItem = (index: number, patch: Partial<FlexItem>) =>
    setFlex((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));

  const setTrack = (index: number, track: Track) =>
    setGrid((current) => ({
      ...current,
      tracks: current.tracks.map((current_, i) => (i === index ? track : current_)),
    }));

  const width = scenario.kind === 'flex' ? flex.containerWidth : grid.containerWidth;
  const gap = scenario.kind === 'flex' ? flex.gap : grid.gap;
  const setWidth = (containerWidth: number) =>
    scenario.kind === 'flex'
      ? setFlex((current) => ({ ...current, containerWidth }))
      : setGrid((current) => ({ ...current, containerWidth }));
  const setGap = (next: number) =>
    scenario.kind === 'flex'
      ? setFlex((current) => ({ ...current, gap: next }))
      : setGrid((current) => ({ ...current, gap: next }));

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

        <div className="grid grid-cols-2 gap-2 md:grid-cols-12 md:gap-x-4">
          <NumberField
            label="Container"
            unit="px"
            value={width}
            onChange={setWidth}
            min={RANGE.containerWidth.min}
            max={RANGE.containerWidth.max}
            step={8}
            className="md:col-span-3"
          />
          <NumberField
            label="Gap"
            unit="px"
            value={gap}
            onChange={setGap}
            min={RANGE.gap.min}
            max={RANGE.gap.max}
            step={4}
            className="md:col-span-3"
          />
          {scenario.kind === 'grid' ? (
            <NumberField
              label="Items"
              value={grid.itemCount}
              onChange={(itemCount) => setGrid((current) => ({ ...current, itemCount }))}
              min={RANGE.itemCount.min}
              max={RANGE.itemCount.max}
              className="md:col-span-3"
            />
          ) : null}
        </div>

        {scenario.kind === 'flex' ? (
          <div className="grid gap-2 md:grid-cols-3 md:gap-x-4">
            {flex.items.map((item, index) => (
              <fieldset
                key={item.label}
                className="border-border rounded-control grid grid-cols-2 gap-2 border p-1"
              >
                <legend className="t-label px-0.5">{item.label}</legend>
                <NumberField
                  label="grow"
                  value={item.grow}
                  onChange={(grow) => setItem(index, { grow })}
                  min={RANGE.factor.min}
                  max={RANGE.factor.max}
                />
                <NumberField
                  label="shrink"
                  value={item.shrink}
                  onChange={(shrink) => setItem(index, { shrink })}
                  min={RANGE.factor.min}
                  max={RANGE.factor.max}
                />
                <NumberField
                  label="basis"
                  unit="px"
                  value={item.basis}
                  onChange={(basis) => setItem(index, { basis })}
                  min={RANGE.basis.min}
                  max={RANGE.basis.max}
                  step={8}
                />
                <Choice
                  label="min-width"
                  value={item.minWidth === 'auto' ? 'auto' : 'px'}
                  options={MIN_WIDTH_OPTIONS}
                  onChange={(mode) => setItem(index, { minWidth: mode === 'auto' ? 'auto' : 0 })}
                />
                <NumberField
                  label="Minimum"
                  unit="px"
                  value={item.minWidth === 'auto' ? 0 : item.minWidth}
                  onChange={(minWidth) => setItem(index, { minWidth })}
                  min={RANGE.minWidth.min}
                  max={RANGE.minWidth.max}
                  step={8}
                  disabled={item.minWidth === 'auto'}
                  className="col-span-2"
                />
              </fieldset>
            ))}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3 md:gap-x-4">
            {grid.tracks.map((track, index) => (
              <TrackControls
                key={index}
                track={track}
                index={index}
                onChange={(next) => setTrack(index, next)}
              />
            ))}
          </div>
        )}

        <div className="rule-t grid gap-3 pt-2 md:grid-cols-12 md:gap-x-4">
          <div className="min-w-0 md:col-span-7">
            {scenario.kind === 'flex' ? (
              <FlexStage
                containerWidth={flex.containerWidth}
                gap={flex.gap}
                items={flex.items}
                active={frame.active}
                containerRef={flexRef}
                probesRef={flexProbesRef}
              />
            ) : (
              <GridStage
                containerWidth={grid.containerWidth}
                gap={grid.gap}
                tracks={grid.tracks}
                itemCount={grid.itemCount}
                resolved={gridResult.tracks}
                active={frame.active}
                containerRef={gridRef}
                probesRef={gridProbesRef}
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
              The stage is a real flex or grid container with real CSS, so what it measures is the
              truth. The arithmetic beside it is the prediction, and it covers less than the two
              specifications do:
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
