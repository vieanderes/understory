'use client';

import { Check, Lightbulb } from 'lucide-react';
import { useId, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/Button';
import { parseCheckBlock } from '@/core/scout';
import { cn } from '@/lib/cn';

/*
 * The Tutor's check (docs/SCOUT-ROLES.md, section 6): one question answered in a tap, with
 * the feedback for the pick shown at once. It is Scout's question, not the course's, so a
 * pick records nothing. A wrong pick can go back to Scout, which then starts from it.
 */

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const CHIP = cn(
  'inline-flex min-h-5 items-center gap-0.5 rounded-full border px-1.5 text-left text-sm font-medium',
  'transition-press active:scale-98 disabled:active:scale-100',
  FOCUS,
);

export function CheckBlock({
  body,
  canSend,
  onSend,
}: {
  body: string;
  /** A provider is ready, so a wrong pick can be talked through. */
  canSend: boolean;
  onSend: (text: string) => void;
}) {
  const check = parseCheckBlock(body);
  const [picked, setPicked] = useState<number | null>(null);
  const labelId = useId();
  if (!check) return null;
  const pick = picked === null ? undefined : check.options[picked];

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1 py-0.5">
      <p id={labelId} className="text-base font-medium text-balance">
        {check.question}
      </p>
      <ul className="flex flex-wrap gap-0.5">
        {check.options.map((option, index) => {
          const on = picked === index;
          return (
            <li key={option.text} className="stream-in" style={{ '--i': index } as CSSProperties}>
              <button
                type="button"
                disabled={picked !== null}
                aria-pressed={on}
                onClick={() => setPicked(index)}
                className={cn(
                  CHIP,
                  on
                    ? 'bg-fg text-bg border-fg'
                    : picked === null
                      ? 'border-border bg-surface text-fg hover:border-border-strong hover:bg-raised'
                      : 'border-border text-faint',
                )}
              >
                {on ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
                {option.text}
              </button>
            </li>
          );
        })}
      </ul>
      {pick ? (
        <div role="status" className="flex flex-col gap-1">
          <p
            className={cn(
              'flex items-center gap-0.5 text-sm font-medium',
              pick.correct ? 'text-success' : 'text-accent',
            )}
          >
            {pick.correct ? (
              <Check aria-hidden size={16} strokeWidth={2} />
            ) : (
              <Lightbulb aria-hidden size={16} strokeWidth={2} />
            )}
            {pick.correct ? 'Right' : 'Not quite'}
          </p>
          <p className="text-sm text-pretty">{pick.feedback}</p>
          {!pick.correct && canSend ? (
            <div>
              <Button
                variant="secondary"
                size="md"
                onClick={() => onSend(`I picked "${pick.text}" on your check.`)}
              >
                Talk it through
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
