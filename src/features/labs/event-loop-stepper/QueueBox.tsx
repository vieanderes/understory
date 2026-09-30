'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface BoxItem {
  key: string;
  label: string;
  /** A short mono annotation on the right: "timer", "due 40 ms". */
  meta?: string;
}

interface QueueBoxProps {
  title: string;
  /** What the first item is: "next" in a queue, "top" on the stack. */
  headLabel: string;
  items: readonly BoxItem[];
  /** Only the frame on top of the stack is the running thing, so only it takes the accent. */
  accentHead?: boolean;
  empty: string;
  children?: React.ReactNode;
}

/** A queue or the stack as a list of hairline boxes. The first item is the one that runs next. */
export function QueueBox({
  title,
  headLabel,
  items,
  accentHead = false,
  empty,
  children,
}: QueueBoxProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h2 className="t-label flex justify-between gap-1">
        <span id={id}>{title}</span>
        <span className="t-figure">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="border-border text-faint rounded-inner flex h-4 items-center border border-dashed px-1 font-mono text-sm">
          {empty}
        </p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {items.map((item, i) => (
            <li
              key={item.key}
              className={cn(
                'rounded-inner flex min-h-4 items-center justify-between gap-1 border px-1 font-mono text-sm',
                i === 0 && accentHead ? 'border-accent font-medium' : 'border-border',
              )}
            >
              <span className="min-w-0 break-words">{item.label}</span>
              <span className="text-muted shrink-0">
                {i === 0 ? `${headLabel}${item.meta ? `, ${item.meta}` : ''}` : item.meta}
              </span>
            </li>
          ))}
        </ol>
      )}
      {children}
    </section>
  );
}
