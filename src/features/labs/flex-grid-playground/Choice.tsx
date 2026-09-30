'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';
import { useAdoptPreHydrationChoice } from '../parts/useAdoptPreHydrationChoice';

interface ChoiceProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A labelled native select. A choice made in the moment between the server's markup and
 * hydration is adopted rather than written over, which matters on a phone where that
 * moment is long.
 */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: ChoiceProps<T>) {
  const id = useId();
  const adopt = useAdoptPreHydrationChoice(value, onChange);
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <label htmlFor={id} className="t-label truncate">
        {label}
      </label>
      <select
        id={id}
        ref={adopt}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        // 16 px: iOS zooms the page when a smaller control takes focus.
        className="border-border bg-surface rounded-control h-5 w-full min-w-0 border px-1 text-base"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
