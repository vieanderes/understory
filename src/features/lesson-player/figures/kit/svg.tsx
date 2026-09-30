import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * The drawing kit: SVG parts that every figure is built from, so that all figures share
 * one hand. Drawn at one user unit per CSS pixel, so text-sm in a drawing is the same
 * 13 px as text-sm on the page. Colours are token utilities only, so a drawing follows
 * the theme it sits in.
 *
 * Every part takes a phase, which is how a stepped figure tells a story:
 *  - future: not reached yet. A faint dashed outline, so the whole shape is visible and
 *    the learner can see where the story is going.
 *  - now: the thing this step is about. Ink, a 2 px line, a sunken fill.
 *  - past: done. A quiet solid line.
 *  - hidden: not there at all yet (a stack frame before its call).
 * Only opacity and transform move, under 300 ms. globals.css removes it for people who
 * ask for reduced motion.
 */

export type Phase = 'hidden' | 'future' | 'now' | 'past';

export type Point = readonly [number, number];

/**
 * The phase of a part that enters at step `from` and is the focus until step `to`.
 * `gone` hides it again from that step on (a frame popped off the stack).
 */
export function phaseAt(
  step: number,
  from: number,
  to: number = from,
  options: { before?: 'hidden' | 'future'; gone?: number } = {},
): Phase {
  if (options.gone !== undefined && step >= options.gone) return 'hidden';
  if (step < from) return options.before ?? 'future';
  if (step <= to) return 'now';
  return 'past';
}

const FADE = 'transition-opacity duration-200 ease-out';
const MOVE = 'transition-transform duration-250 ease-out';

const STROKE: Record<Phase, string> = {
  hidden: 'stroke-faint',
  future: 'stroke-faint',
  now: 'stroke-fg',
  past: 'stroke-muted',
};

const TEXT: Record<Phase, string> = {
  hidden: 'fill-faint',
  future: 'fill-faint',
  now: 'fill-fg',
  past: 'fill-muted',
};

/** Mono text on the drawing. `tone` overrides the phase colour for a fixed label. */
export function Label({
  x,
  y,
  children,
  anchor = 'middle',
  phase = 'past',
  weight = 'normal',
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  phase?: Phase;
  weight?: 'normal' | 'medium';
  className?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      className={cn(
        'font-mono text-sm',
        TEXT[phase],
        weight === 'medium' && 'font-medium',
        phase === 'hidden' && 'opacity-0',
        FADE,
        className,
      )}
    >
      {children}
    </text>
  );
}

/**
 * A box with an optional one-line label and a quieter second line. The "now" look is a
 * layer of its own that fades in, because only opacity may animate.
 */
export function Box({
  x,
  y,
  w,
  h,
  phase = 'past',
  label,
  sub,
  radius = 8,
  ink = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  phase?: Phase;
  label?: ReactNode;
  sub?: ReactNode;
  radius?: number;
  /** A solid ink block, for the one thing a figure is about (the answer, the content box). */
  ink?: boolean;
}) {
  const cx = x + w / 2;
  const textPhase: Phase = ink && phase !== 'future' && phase !== 'hidden' ? 'past' : phase;
  return (
    <g className={cn(FADE, phase === 'hidden' ? 'opacity-0' : 'opacity-100')}>
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={w - 1}
        height={h - 1}
        rx={radius}
        strokeWidth={1}
        strokeDasharray={phase === 'future' ? '3 4' : undefined}
        className={cn(
          ink && phase !== 'future' ? 'fill-fg stroke-fg' : 'fill-surface',
          !(ink && phase !== 'future') && STROKE[phase],
        )}
      />
      {!ink ? (
        <rect
          x={x + 1}
          y={y + 1}
          width={w - 2}
          height={h - 2}
          rx={radius - 0.5}
          strokeWidth={2}
          className={cn(
            'fill-sunken stroke-fg',
            FADE,
            phase === 'now' ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      {label !== undefined ? (
        <Label
          x={cx}
          y={sub !== undefined ? y + h / 2 - 10 : y + h / 2}
          phase={textPhase}
          weight={phase === 'now' ? 'medium' : 'normal'}
          className={ink && phase !== 'future' ? 'fill-bg' : undefined}
        >
          {label}
        </Label>
      ) : null}
      {sub !== undefined ? (
        <Label
          x={cx}
          y={y + h / 2 + 10}
          phase={phase === 'now' ? 'past' : textPhase}
          className={ink && phase !== 'future' ? 'fill-bg' : undefined}
        >
          {sub}
        </Label>
      ) : null}
    </g>
  );
}

function head(from: Point, to: Point, size: number): string {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const back = (a: number): Point => [
    to[0] - size * Math.cos(angle + a),
    to[1] - size * Math.sin(angle + a),
  ];
  const [l, r] = [back(0.45), back(-0.45)];
  return `M ${l[0]} ${l[1]} L ${to[0]} ${to[1]} L ${r[0]} ${r[1]}`;
}

/**
 * An arrow through a list of points, straight segments with softened corners, the way a
 * technical drawing routes a line. The head is an open chevron drawn at the last point.
 */
export function Arrow({
  points,
  phase = 'past',
  headAt = 'end',
}: {
  points: readonly Point[];
  phase?: Phase;
  headAt?: 'end' | 'none';
}) {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const last = points[points.length - 1]!;
  const before = points[points.length - 2]!;
  return (
    <g
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={phase === 'now' ? 2 : 1}
      strokeDasharray={phase === 'future' ? '3 4' : undefined}
      className={cn(STROKE[phase], FADE, phase === 'hidden' ? 'opacity-0' : 'opacity-100')}
    >
      <path d={d} />
      {headAt === 'end' ? <path d={head(before, last, 7)} strokeDasharray="none" /> : null}
    </g>
  );
}

/**
 * A numbered marker on the drawing. Its number matches a line in the key beside it. When
 * the step is about that part, the marker fills with ink.
 */
export function Marker({ x, y, n, on = false }: { x: number; y: number; n: number; on?: boolean }) {
  return (
    <g aria-hidden="true">
      <circle
        cx={x}
        cy={y}
        r={10}
        strokeWidth={1}
        className={cn('stroke-fg', on ? 'fill-fg' : 'fill-surface')}
      />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn('t-figure text-sm font-medium', on ? 'fill-bg' : 'fill-fg')}
      >
        {n}
      </text>
    </g>
  );
}

/** A dimension line: an extent with a tick at each end, and its measure written on it. */
export function Dim({
  from,
  to,
  label,
  phase = 'past',
  side = 'before',
}: {
  from: Point;
  to: Point;
  label?: ReactNode;
  phase?: Phase;
  /** Which side of the line the label sits on: above or left ("before"), below or right. */
  side?: 'before' | 'after';
}) {
  const vertical = from[0] === to[0];
  const t = 4;
  const ticks = vertical
    ? `M ${from[0] - t} ${from[1]} L ${from[0] + t} ${from[1]} M ${to[0] - t} ${to[1]} L ${to[0] + t} ${to[1]}`
    : `M ${from[0]} ${from[1] - t} L ${from[0]} ${from[1] + t} M ${to[0]} ${to[1] - t} L ${to[0]} ${to[1] + t}`;
  const mid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const offset = side === 'before' ? -12 : 12;
  return (
    <g className={cn(FADE, phase === 'hidden' ? 'opacity-0' : 'opacity-100')}>
      <path
        d={`M ${from[0]} ${from[1]} L ${to[0]} ${to[1]} ${ticks}`}
        fill="none"
        strokeWidth={1}
        className={STROKE[phase === 'now' ? 'now' : 'past']}
      />
      {label !== undefined ? (
        <Label
          x={vertical ? mid[0] + offset : mid[0]}
          y={vertical ? mid[1] : mid[1] + offset}
          anchor={vertical ? (side === 'before' ? 'end' : 'start') : 'middle'}
          phase={phase === 'now' ? 'now' : 'past'}
        >
          {label}
        </Label>
      ) : null}
    </g>
  );
}

/**
 * Something that travels: a message on a wire, a question moving down a pipeline. It
 * glides between steps with a transform, the one kind of movement the design allows.
 */
export function Token({
  at,
  visible = true,
  children,
}: {
  at: Point;
  visible?: boolean;
  children?: ReactNode;
}) {
  return (
    <g
      style={{ transform: `translate(${at[0]}px, ${at[1]}px)` }}
      className={cn(MOVE, visible ? 'opacity-100' : 'opacity-0')}
    >
      <circle r={5} className="fill-fg" />
      {children}
    </g>
  );
}

/**
 * A pile of rows, newest on top: the call stack. Rows enter by fading and sliding down a
 * few pixels into place; the top row is the focus.
 */
export function Stack({
  x,
  bottom,
  w,
  rowH = 32,
  gap = 8,
  capacity,
  items,
  label,
}: {
  x: number;
  /** The y of the stack's floor. Rows grow upward from it. */
  bottom: number;
  w: number;
  rowH?: number;
  gap?: number;
  /** How many slots to leave room for. Empty slots are not drawn. */
  capacity: number;
  items: readonly { key: string; label: ReactNode; sub?: ReactNode; phase?: Phase }[];
  label?: ReactNode;
}) {
  const top = bottom - capacity * (rowH + gap);
  return (
    <g>
      {label !== undefined ? (
        <Label x={x} y={top - 4} anchor="start" phase="past" className="t-label">
          {label}
        </Label>
      ) : null}
      <path
        d={`M ${x - 4} ${bottom + 4} L ${x + w + 4} ${bottom + 4}`}
        strokeWidth={1}
        className="stroke-muted"
      />
      {items.map((item, i) => {
        const y = bottom - (i + 1) * (rowH + gap) + gap;
        const onTop = i === items.length - 1;
        return (
          <g key={item.key} className={cn(FADE, 'starting:opacity-0')}>
            <Box
              x={x}
              y={y}
              w={w}
              h={rowH}
              phase={item.phase ?? (onTop ? 'now' : 'past')}
              label={item.label}
              sub={item.sub}
              radius={4}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * A queue as a row of slots, first in line on the left. Items keep their key, so one that
 * moves along the line glides with a transform.
 */
export function Queue({
  x,
  y,
  slotW,
  h = 32,
  gap = 8,
  slots,
  items,
  label,
  empty = 'empty',
}: {
  x: number;
  y: number;
  slotW: number;
  h?: number;
  gap?: number;
  slots: number;
  items: readonly { key: string; label: ReactNode; phase?: Phase }[];
  label?: ReactNode;
  empty?: string;
}) {
  const w = slots * slotW + (slots - 1) * gap;
  return (
    <g>
      {label !== undefined ? (
        <Label x={x} y={y - 14} anchor="start" phase="past" className="t-label">
          {label}
        </Label>
      ) : null}
      <rect
        x={x - 3.5}
        y={y - 3.5}
        width={w + 7}
        height={h + 7}
        rx={6}
        strokeWidth={1}
        strokeDasharray="3 4"
        className="stroke-faint fill-none"
      />
      {items.length === 0 ? (
        <Label x={x + w / 2} y={y + h / 2} phase="future">
          {empty}
        </Label>
      ) : null}
      {items.map((item, i) => (
        <g
          key={item.key}
          style={{
            transform: `translate(${x + i * (slotW + gap)}px, ${y}px)`,
            transitionProperty: 'opacity, transform',
          }}
          className={cn(MOVE, 'starting:opacity-0')}
        >
          <Box
            x={0}
            y={0}
            w={slotW}
            h={h}
            radius={4}
            phase={item.phase ?? (i === 0 ? 'now' : 'past')}
            label={item.label}
          />
        </g>
      ))}
    </g>
  );
}

/**
 * A few lines of source with line numbers, the running lines marked the way the labs mark
 * them: a sunken bar with an ink rule at its left edge.
 */
export function CodePanel({
  x,
  y,
  w,
  lines,
  current = [],
  lineH = 20,
}: {
  x: number;
  y: number;
  w: number;
  lines: readonly string[];
  /** 1-based lines to mark. */
  current?: readonly number[];
  lineH?: number;
}) {
  const h = lines.length * lineH + 16;
  return (
    <g>
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={w - 1}
        height={h - 1}
        rx={8}
        strokeWidth={1}
        className="fill-bg stroke-border"
      />
      {lines.map((line, i) => {
        const on = current.includes(i + 1);
        const top = y + 8 + i * lineH;
        return (
          <g key={i}>
            <rect
              x={x + 1}
              y={top}
              width={w - 2}
              height={lineH}
              className={cn('fill-sunken', FADE, on ? 'opacity-100' : 'opacity-0')}
            />
            <rect
              x={x + 1}
              y={top}
              width={2}
              height={lineH}
              className={cn('fill-fg', FADE, on ? 'opacity-100' : 'opacity-0')}
            />
            <text
              x={x + 24}
              y={top + lineH / 2}
              textAnchor="end"
              dominantBaseline="central"
              className="t-figure fill-faint text-sm"
            >
              {i + 1}
            </text>
            <text
              x={x + 36}
              y={top + lineH / 2}
              dominantBaseline="central"
              xmlSpace="preserve"
              className={cn('font-mono text-sm', on ? 'fill-fg' : 'fill-muted')}
            >
              {line}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** A decision: a diamond with its question inside. */
export function Diamond({
  cx,
  cy,
  rx,
  ry,
  label,
  phase = 'past',
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  label: ReactNode;
  phase?: Phase;
}) {
  const d = `M ${cx} ${cy - ry} L ${cx + rx} ${cy} L ${cx} ${cy + ry} L ${cx - rx} ${cy} Z`;
  return (
    <g>
      <path
        d={d}
        strokeWidth={1}
        strokeDasharray={phase === 'future' ? '3 4' : undefined}
        strokeLinejoin="round"
        className={cn('fill-surface', STROKE[phase])}
      />
      <path
        d={d}
        strokeWidth={2}
        strokeLinejoin="round"
        className={cn('fill-sunken stroke-fg', FADE, phase === 'now' ? 'opacity-100' : 'opacity-0')}
      />
      <Label x={cx} y={cy} phase={phase} weight={phase === 'now' ? 'medium' : 'normal'}>
        {label}
      </Label>
    </g>
  );
}
