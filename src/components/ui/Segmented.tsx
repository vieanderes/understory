'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Hide the label visually when the surrounding text already names the control. */
  hideLabel?: boolean;
  /** Label beside the control on one line, with shorter segments: for a bar short on height. */
  inline?: boolean;
  className?: string;
}

/**
 * A short, mutually exclusive choice that applies at once: confidence, session length,
 * theme. Native radios underneath, so arrow keys, focus and form semantics come free.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel,
  inline,
  className,
}: SegmentedProps<T>) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cn(inline && 'flex items-center gap-1.5', className)}
    >
      <p id={labelId} className={cn('t-label shrink-0', hideLabel && 'sr-only')}>
        {label}
      </p>
      <div
        className={cn(
          'border-border rounded-control grid auto-cols-fr grid-flow-col border p-0.5',
          inline ? 'min-w-0 flex-1' : !hideLabel && 'mt-1',
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'rounded-inner flex cursor-pointer items-center justify-center px-1 text-sm font-medium',
                'transition-colors duration-150 ease-out has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                'has-focus-visible:outline-accent',
                // 32 px inline still clears the 24 px target floor.
                inline ? 'h-4' : 'h-5',
                checked ? 'bg-fg text-bg' : 'text-muted hover:text-fg',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
