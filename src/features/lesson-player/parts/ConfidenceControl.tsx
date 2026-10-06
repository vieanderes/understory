'use client';

import { useId } from 'react';
import type { Confidence } from '@/core/progress';
import { cn } from '@/lib/cn';

const OPTIONS: readonly { value: Confidence; label: string }[] = [
  { value: 'guess', label: 'Guess' },
  { value: 'fairly', label: 'Pretty sure' },
  { value: 'certain', label: 'Certain' },
];

/**
 * Asked before the answer is checked. Stating confidence first is what makes a confident
 * error stick once corrected (Butterfield and Metcalfe 2001), and it feeds the
 * calibration dial: how often "certain" is right.
 *
 * It sits in the action bar beside Skip and Check, so it is drawn to their measure: the
 * same 48 px height and radius as a large button, the labels in the button's weight. The
 * options say how sure on their own, so the question is for screen readers only.
 */
export function ConfidenceControl({
  value,
  onChange,
  className,
}: {
  value: Confidence | null;
  onChange: (value: Confidence) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label="How sure are you?"
      className={cn(
        'border-border bg-surface rounded-control grid h-6 auto-cols-fr grid-flow-col border p-0.5',
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'rounded-inner flex cursor-pointer items-center justify-center px-2 text-base whitespace-nowrap select-none',
              'transition-colors duration-150 ease-out',
              'has-focus-visible:outline-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
              checked ? 'bg-fg text-bg' : 'text-muted hover:text-fg hover:bg-raised',
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
  );
}
