'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

interface SplitterProps {
  /** `vertical` divides columns (drag sideways), `horizontal` divides rows. */
  orientation: 'vertical' | 'horizontal';
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Dragging towards the start grows the value, as for a panel below or right of the rule. */
  invert?: boolean;
  tour?: string;
}

const STEP = 16;

/**
 * The 4 px dividers between the task, the editor and the output. A focusable separator,
 * so arrow keys resize as well as the pointer does (WCAG 2.5.7 asks for a single-pointer
 * alternative to dragging; keys and Home/End cover it).
 */
export function Splitter({
  orientation,
  label,
  value,
  min,
  max,
  onChange,
  invert = false,
  tour,
}: SplitterProps) {
  const start = useRef<{ pointer: number; value: number } | null>(null);
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)));
  const vertical = orientation === 'vertical';
  const sign = invert ? -1 : 1;

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-tour={tour}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { pointer: vertical ? event.clientX : event.clientY, value };
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        const delta = (vertical ? event.clientX : event.clientY) - start.current.pointer;
        onChange(clamp(start.current.value + sign * delta));
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onKeyDown={(event) => {
        const grow = vertical ? 'ArrowRight' : 'ArrowDown';
        const shrink = vertical ? 'ArrowLeft' : 'ArrowUp';
        if (event.key === grow) onChange(clamp(value + sign * STEP));
        else if (event.key === shrink) onChange(clamp(value - sign * STEP));
        else if (event.key === 'Home') onChange(min);
        else if (event.key === 'End') onChange(max);
        else return;
        event.preventDefault();
      }}
      className={cn(
        'bg-border hover:bg-border-strong focus-visible:bg-accent shrink-0 touch-none transition-colors outline-none',
        vertical ? 'w-0.5 cursor-col-resize' : 'h-0.5 cursor-row-resize',
      )}
    />
  );
}
