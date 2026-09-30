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
  className,
}: SegmentedProps<T>) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <div role="radiogroup" aria-labelledby={labelId} className={className}>
      <p id={labelId} className={cn('t-label', hideLabel && 'sr-only')}>
        {label}
      </p>
      <div
        className={cn(
          'border-border rounded-control grid auto-cols-fr grid-flow-col border p-0.5',
          !hideLabel && 'mt-1',
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'rounded-inner flex h-5 cursor-pointer items-center justify-center px-1 text-sm font-medium',
                'transition-colors duration-150 ease-out has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                'has-focus-visible:outline-accent',
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
