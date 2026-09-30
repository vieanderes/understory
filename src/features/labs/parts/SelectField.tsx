'use client';

import { useId, type Ref } from 'react';
import { cn } from '@/lib/cn';

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** For `useAdoptPreHydrationChoice`, so a choice made before hydration is kept. */
  selectRef?: Ref<HTMLSelectElement>;
  className?: string;
}

/** A native select under a micro label: for choices too many or too long for Segmented. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  selectRef,
  className,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <label htmlFor={id} className="t-label truncate">
        {label}
      </label>
      <select
        id={id}
        ref={selectRef}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        // 16 px: iOS zooms the page when a smaller control takes focus.
        className="border-border bg-surface rounded-control t-figure h-5 w-full min-w-0 border px-1 text-base"
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
