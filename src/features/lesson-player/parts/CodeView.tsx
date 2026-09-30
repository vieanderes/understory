'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

interface CodeViewProps {
  html: string;
  label: string;
  /** When set, lines can be picked. Picked and judged lines are marked through data attributes. */
  picked?: readonly number[];
  onPick?: (line: number) => void;
  verdicts?: Readonly<Record<number, 'right' | 'wrong'>>;
  className?: string;
}

/**
 * Highlighted code from the content bundle. The markup is static HTML; picking works by
 * event delegation and by stamping data attributes on the existing line spans, so React
 * never has to re-create the code to mark one line.
 */
export function CodeView({ html, label, picked, onPick, verdicts, className }: CodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pickable = Boolean(onPick);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const line of root.querySelectorAll<HTMLElement>('.line')) {
      const n = Number(line.dataset.line);
      line.dataset.picked = String(picked?.includes(n) ?? false);
      const verdict = verdicts?.[n];
      if (verdict) line.dataset.verdict = verdict;
      else delete line.dataset.verdict;
      if (pickable) {
        line.setAttribute('role', 'button');
        line.setAttribute('tabindex', '0');
        line.setAttribute('aria-pressed', String(picked?.includes(n) ?? false));
        line.setAttribute('aria-label', `Line ${n}: ${line.textContent ?? ''}`);
      }
    }
  }, [html, picked, verdicts, pickable]);

  function lineOf(target: EventTarget): number | null {
    const line = (target as HTMLElement).closest<HTMLElement>('.line');
    return line ? Number(line.dataset.line) : null;
  }

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn('code-view wrap', pickable && 'pickable', className)}
      onClick={(e) => {
        const n = lineOf(e.target);
        if (n !== null) onPick?.(n);
      }}
      onKeyDown={(e) => {
        if (!pickable || (e.key !== 'Enter' && e.key !== ' ')) return;
        const n = lineOf(e.target);
        if (n === null) return;
        e.preventDefault();
        onPick?.(n);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
