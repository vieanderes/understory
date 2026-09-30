'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

interface CodePanelProps {
  source: string;
  /** 1-based, or null when no code is running. */
  line: number | null;
}

/** The program, with the running line marked. Long lines scroll inside the panel. */
export function CodePanel({ source, line }: CodePanelProps) {
  const lines = source.split('\n');
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h2 id={id} className="t-label">
        Program
      </h2>
      <div
        role="region"
        aria-label="Program source"
        tabIndex={0}
        className="border-border bg-bg rounded-control overflow-x-auto border py-1"
      >
        <ol className="w-max min-w-full font-mono text-sm">
          {lines.map((text, i) => {
            const current = line === i + 1;
            return (
              <li
                key={i}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'code-line border-l-2 pr-2',
                  current ? 'border-accent bg-accent-tint font-medium' : 'border-transparent',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    't-figure pr-1 text-right select-none',
                    // The faint number does not reach 4.5:1 on the tinted line.
                    current ? 'text-fg' : 'text-faint',
                  )}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre">{text === '' ? ' ' : text}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="text-muted text-sm">
        {line === null ? 'No line is running.' : `Line ${line} is running.`}
      </p>
    </section>
  );
}
