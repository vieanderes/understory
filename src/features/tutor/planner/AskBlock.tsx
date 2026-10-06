'use client';

import { Check, PenLine } from 'lucide-react';
import { useId, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/Button';
import type { AskBlock as Ask } from '@/core/planner';
import { cn } from '@/lib/cn';

/*
 * One of Scout's questions with its answers to tap. Single choice sends on the tap; several
 * are ticked, then sent together. Only the newest question can be answered; an older one
 * shows what was picked. A typed answer always works too: "Something else" goes to the box.
 */

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const CHIP = cn(
  'inline-flex min-h-5 items-center gap-0.5 rounded-full border px-1.5 text-left text-sm font-medium',
  'transition-press active:scale-98 disabled:active:scale-100',
  FOCUS,
);

/** Several answers travel as one message, in the order they were offered. */
export const joinAnswers = (picked: readonly string[]): string => picked.join(', ');

export function AskBlock({
  ask,
  live,
  answer,
  onSend,
  onOther,
  question = ask.question,
}: {
  ask: Ask;
  /** The newest question, and a provider ready to hear the answer. */
  live: boolean;
  /** What the learner said after it, for an older question. */
  answer?: string;
  onSend: (text: string) => void;
  onOther: () => void;
  /** The opening question is the app's own, so it can be worded here instead. */
  question?: string;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const labelId = useId();
  const chosen = (option: string) =>
    live ? picked.includes(option) : (answer ?? '').split(', ').includes(option);

  const tap = (option: string) => {
    if (!ask.multi) return onSend(option);
    setPicked((now) =>
      now.includes(option)
        ? now.filter((o) => o !== option)
        : ask.options.filter((o) => o === option || now.includes(o)),
    );
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1 py-0.5">
      <p id={labelId} className="text-base font-medium text-balance">
        {question}
        {ask.multi && live ? <span className="sr-only"> Choose any that apply.</span> : null}
      </p>
      <ul className="flex flex-wrap gap-0.5">
        {ask.options.map((option, index) => {
          const on = chosen(option);
          return (
            <li key={option} className="stream-in" style={{ '--i': index } as CSSProperties}>
              <button
                type="button"
                disabled={!live}
                onClick={() => tap(option)}
                {...(ask.multi ? { 'aria-pressed': on } : {})}
                className={cn(
                  CHIP,
                  on
                    ? 'bg-fg text-bg border-fg'
                    : live
                      ? 'border-border bg-surface text-fg hover:border-border-strong hover:bg-raised'
                      : 'border-border text-faint',
                )}
              >
                {on ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
                {option}
              </button>
            </li>
          );
        })}
        {live ? (
          <li className="stream-in" style={{ '--i': ask.options.length } as CSSProperties}>
            <button
              type="button"
              onClick={onOther}
              className={cn(CHIP, 'text-muted hover:text-fg hover:bg-raised border-transparent')}
            >
              <PenLine aria-hidden size={16} strokeWidth={2} />
              Something else
            </button>
          </li>
        ) : null}
      </ul>
      {ask.multi && live ? (
        <div>
          <Button
            variant="primary"
            size="md"
            disabled={picked.length === 0}
            onClick={() => onSend(joinAnswers(picked))}
          >
            {picked.length > 1 ? `Send ${picked.length} answers` : 'Send'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
