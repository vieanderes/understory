'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Shown after the figure: "px", "%", "fr". */
  unit?: string;
  disabled?: boolean;
  className?: string;
}

const STEP_BUTTON = cn(
  'text-muted hover:text-fg hover:bg-raised inline-flex size-5 shrink-0 items-center justify-center',
  'transition-press active:scale-98 disabled:pointer-events-none disabled:opacity-40',
);

/**
 * A number with a 40 px button either side, for thumbs, and a typed field between them,
 * for keyboards (arrow keys step it, as in any number input). Out-of-range input is
 * clamped, and a half-typed value is held as a draft so that clearing the field to type
 * a new figure does not snap back.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled,
  className,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const name = unit ? `${label}, ${unit}` : label;

  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <label htmlFor={id} className="t-label truncate">
        {label}
      </label>
      <div
        className={cn(
          'border-border bg-surface rounded-control flex h-5 items-center overflow-hidden border',
          // A flat ground, not opacity: the unit label is text too, and faded it fails contrast.
          disabled && 'bg-sunken',
        )}
      >
        <button
          type="button"
          className={STEP_BUTTON}
          onClick={() => onChange(clamp(value - step))}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
          title={`Decrease ${label}`}
        >
          <Minus aria-hidden size={16} strokeWidth={2} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={name}
          value={draft ?? String(value)}
          onChange={(event) => {
            setDraft(event.target.value);
            const typed = event.target.valueAsNumber;
            if (Number.isFinite(typed)) onChange(clamp(typed));
          }}
          onBlur={() => setDraft(null)}
          // 16 px: iOS zooms the page when a smaller input takes focus.
          className="t-figure no-spinner disabled:text-muted h-5 w-full min-w-4 bg-transparent text-center text-base"
        />
        {unit ? (
          <span aria-hidden className="t-figure text-muted pr-0.5 text-sm">
            {unit}
          </span>
        ) : null}
        <button
          type="button"
          className={STEP_BUTTON}
          onClick={() => onChange(clamp(value + step))}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
          title={`Increase ${label}`}
        >
          <Plus aria-hidden size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
