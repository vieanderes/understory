'use client';

import { useId } from 'react';
import { useAdoptPreHydrationChoice } from '../parts/useAdoptPreHydrationChoice';
import { cn } from '@/lib/cn';

interface SelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}

/**
 * The shared SelectField with one addition: a choice made before the page hydrates is
 * adopted rather than overwritten, which on a slow phone is the difference between the
 * control working and the learner's choice vanishing under their hand.
 */
export function Select({ label, value, options, onChange, className }: SelectProps) {
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
        onChange={(event) => onChange(event.target.value)}
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
