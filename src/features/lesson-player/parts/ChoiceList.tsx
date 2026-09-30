'use client';

import { useId } from 'react';
import type { CompiledChoice } from '@/core/content/compiled';
import { cn } from '@/lib/cn';
import { RichText } from './RichText';

interface ChoiceListProps {
  legend: string;
  choices: readonly CompiledChoice[];
  /** Display order: indexes into `choices`. */
  order: readonly number[];
  selected: number | null;
  onSelect: (index: number) => void;
  /** After checking, the list locks and marks the right choice and a wrong pick. */
  checked: boolean;
  /** Mark the right choice. Held back while a second try is on offer. */
  reveal: boolean;
}

/** Radios drawn as full-width rows. Keys 1 to 6 pick a row; arrow keys come with radios. */
export function ChoiceList({
  legend,
  choices,
  order,
  selected,
  onSelect,
  checked,
  reveal,
}: ChoiceListProps) {
  const name = useId();
  return (
    <fieldset disabled={checked} className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-col gap-1">
        {order.map((index, position) => {
          const choice = choices[index];
          if (!choice) return null;
          const isSelected = selected === index;
          const showRight = checked && reveal && choice.correct;
          const showWrong = checked && isSelected && !choice.correct;
          return (
            <label
              key={index}
              className={cn(
                'rounded-control flex min-h-6 items-center gap-2 border px-2 py-1 transition-colors duration-150 ease-out',
                'has-focus-visible:outline-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                !checked && 'cursor-pointer',
                showRight
                  ? 'border-success'
                  : showWrong
                    ? 'border-accent'
                    : isSelected
                      ? 'border-accent bg-accent-tint'
                      : 'border-border hover:bg-raised',
                checked && !showRight && !showWrong && 'opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                checked={isSelected}
                onChange={() => onSelect(index)}
                className="sr-only"
              />
              <span aria-hidden className="t-figure text-faint w-2 text-sm">
                {position + 1}
              </span>
              <RichText inline value={choice.text} className="min-w-0 flex-1" />
              {showRight ? <span className="text-success text-sm font-medium">Right</span> : null}
              {showWrong ? (
                <span className="text-accent text-sm font-medium">Your pick</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
