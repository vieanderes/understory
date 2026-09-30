'use client';

import { useRef } from 'react';
import type { CurvePoint } from '@/core/labs/btree-index-explorer';
import { useLayoutMeasure } from '../parts/useLayoutMeasure';

/*
 * Two lines against one another: the flat cost of reading every heap page in order, and
 * the cost of an index scan as the predicate matches more and more rows. Both axes are
 * logarithmic, because both span several decades. Labels sit on the lines themselves, so
 * there is no legend to match up and nothing to hover.
 */

/* Drawn at the real width of its column, so the labels stay at the reading size. */
const DEFAULT_W = 520;
const MIN_W = 240;
const H = 210;
const ML = 44;
const MR = 14;
const MT = 20;
const MB = 42;
const PLOT_H = H - MT - MB;

export const figure = (n: number): string => Math.round(n).toLocaleString('en-GB');

/** A compact axis figure: 1, 10, 1k, 10M. Axis labels must not wrap or collide. */
function tickLabel(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
}

/** A selectivity in words: a percentage while that reads sensibly, a ratio below it. */
export function share(selectivity: number): string {
  if (selectivity >= 0.01) return `${Math.round(selectivity * 100)}%`;
  if (selectivity >= 0.0001) return `${(selectivity * 100).toFixed(2)}%`;
  return `1 row in ${figure(1 / selectivity)}`;
}

interface CostChartProps {
  points: readonly CurvePoint[];
  rows: number;
  seqCost: number;
  indexCost: number | null;
  selectivity: number;
  crossover: number | null;
}

export function CostChart({
  points,
  rows,
  seqCost,
  indexCost,
  selectivity,
  crossover,
}: CostChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const measured = useLayoutMeasure<number>(() => box.current?.clientWidth ?? null);
  const W = Math.max(MIN_W, measured ?? DEFAULT_W);
  const PLOT_W = W - ML - MR;
  const sMin = 1 / rows;
  const logMin = Math.log10(sMin);
  const x = (s: number) => ML + ((Math.log10(Math.max(s, sMin)) - logMin) / -logMin) * PLOT_W;

  const costs = [seqCost, ...points.flatMap((p) => (p.indexCost === null ? [] : [p.indexCost]))];
  const lo = 10 ** Math.floor(Math.log10(Math.max(1, Math.min(...costs))));
  const hi = 10 ** Math.ceil(Math.log10(Math.max(...costs)));
  const yTop = hi === lo ? lo * 10 : hi;
  const span = Math.log10(yTop) - Math.log10(lo);
  const y = (c: number) =>
    MT + (1 - (Math.log10(Math.max(c, lo)) - Math.log10(lo)) / span) * PLOT_H;

  const decades = Math.round(span);
  const tickStep = decades > 5 ? Math.ceil(decades / 5) : 1;
  const yTicks = Array.from({ length: decades + 1 }, (_, i) => lo * 10 ** i).filter(
    (_, i) => i % tickStep === 0,
  );

  const curve = points
    .filter((p) => p.indexCost !== null)
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${x(p.selectivity).toFixed(1)} ${y(p.indexCost!).toFixed(1)}`,
    )
    .join(' ');

  const seqY = y(seqCost);
  const nowX = x(selectivity);
  const anchorAt = (at: number) => (at > ML + PLOT_W * 0.6 ? 'end' : 'start');
  const nudge = (at: number) => (at > ML + PLOT_W * 0.6 ? -4 : 4);

  const summary =
    indexCost === null
      ? `A sequential scan reads ${figure(seqCost / 1)} in cost units. No index serves this predicate.`
      : `At ${share(selectivity)} of ${figure(rows)} rows the index scan costs ${figure(indexCost)} against ${figure(seqCost)} for the sequential scan.` +
        (crossover === null
          ? ' The two lines do not cross over this range.'
          : ` The lines cross at ${share(crossover)}.`);

  return (
    <div ref={box} className="min-w-0">
      {/* The viewBox is the measured width, so the drawing sits at 1:1 and the labels
          keep their reading size. Before the first measurement it scales to fit, which
          is what keeps the page from scrolling sideways between paint and hydration. */}
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        fill="none"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={ML}
              x2={ML + PLOT_W}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={ML - 6}
              y={y(tick)}
              fill="currentColor"
              textAnchor="end"
              dominantBaseline="central"
              className="text-faint font-mono text-sm"
            >
              {tickLabel(tick)}
            </text>
          </g>
        ))}

        <text
          x={ML}
          y={H - 22}
          fill="currentColor"
          textAnchor="start"
          className="text-faint font-mono text-sm"
        >
          1 row
        </text>
        <text
          x={ML + PLOT_W}
          y={H - 22}
          fill="currentColor"
          textAnchor="end"
          className="text-faint font-mono text-sm"
        >
          all {figure(rows)}
        </text>

        <line
          x1={ML}
          x2={ML + PLOT_W}
          y1={seqY}
          y2={seqY}
          stroke="currentColor"
          strokeWidth="1"
          className="text-fg"
        />
        <text
          x={ML + 4}
          y={seqY - 6}
          fill="currentColor"
          textAnchor="start"
          className="text-fg font-mono text-sm"
        >
          Seq Scan {figure(seqCost)}
        </text>

        {curve === '' ? (
          <text
            x={ML + PLOT_W / 2}
            y={MT + PLOT_H / 2}
            fill="currentColor"
            textAnchor="middle"
            className="text-muted font-mono text-sm"
          >
            No index serves this predicate
          </text>
        ) : (
          <>
            <path d={curve} stroke="currentColor" strokeWidth="1" className="text-muted" />
            <text
              x={ML + PLOT_W}
              y={y(points[points.length - 1]!.indexCost!) - 6}
              fill="currentColor"
              textAnchor="end"
              className="text-muted font-mono text-sm"
            >
              Index Scan
            </text>
          </>
        )}

        {crossover === null ? null : (
          <g>
            <line
              x1={x(crossover)}
              x2={x(crossover)}
              y1={MT}
              y2={MT + PLOT_H}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={x(crossover) + nudge(x(crossover))}
              y={H - 6}
              fill="currentColor"
              textAnchor={anchorAt(x(crossover))}
              className="text-muted font-mono text-sm"
            >
              crossover {share(crossover)}
            </text>
          </g>
        )}

        <g className="text-accent">
          <line
            x1={nowX}
            x2={nowX}
            y1={MT}
            y2={MT + PLOT_H}
            stroke="currentColor"
            strokeWidth="1"
          />
          {indexCost === null ? null : (
            <circle cx={nowX} cy={y(indexCost)} r="3" fill="currentColor" />
          )}
          <circle cx={nowX} cy={seqY} r="3" fill="currentColor" />
          <text
            x={nowX + nudge(nowX)}
            y={MT - 6}
            fill="currentColor"
            textAnchor={anchorAt(nowX)}
            className="font-mono text-sm"
          >
            this query {share(selectivity)}
          </text>
        </g>
      </svg>
    </div>
  );
}
