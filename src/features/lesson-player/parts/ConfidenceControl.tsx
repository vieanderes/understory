'use client';

import { Segmented } from '@/components/ui/Segmented';
import type { Confidence } from '@/core/progress';

const OPTIONS = [
  { value: 'guess', label: 'Guess' },
  { value: 'fairly', label: 'Fairly' },
  { value: 'certain', label: 'Certain' },
] as const;

/**
 * Asked before the answer is checked. Stating confidence first is what makes a confident
 * error stick once corrected (Butterfield and Metcalfe 2001), and it feeds the
 * calibration dial: how often "certain" is right.
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
  return (
    <Segmented
      inline
      label="How sure"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
