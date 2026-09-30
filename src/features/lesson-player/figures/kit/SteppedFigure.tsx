'use client';

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useStepper } from './useStepper';

export interface FigureKeyItem {
  n: number;
  title: string;
  body: string;
}

export interface FigureStep {
  /** The state of the drawing at this step, in words. It is what a screen reader hears. */
  text: string;
  /** The key items this step is about. Their markers fill and their lines darken. */
  focus?: readonly number[];
}

interface SteppedFigureProps {
  /** What the drawing is, as its accessible name: "The RAG pipeline". */
  title: string;
  width: number;
  height: number;
  keyItems: readonly FigureKeyItem[];
  steps: readonly FigureStep[];
  /** Draws the figure at a step. Called with 0 on the server and before any interaction. */
  draw: (step: number, focus: ReadonlySet<number>) => ReactNode;
}

const CONTROL =
  'rounded-control border-border text-fg hover:bg-raised transition-press inline-flex h-5 items-center justify-center gap-0.5 border px-1 text-sm font-medium active:scale-98 aria-disabled:bg-sunken aria-disabled:text-faint aria-disabled:active:scale-100';

/**
 * A figure told in steps: the drawing, a sentence for the current step, Back and Next,
 * and a key that names each numbered marker. Every state is also a sentence, so nothing
 * is carried by the picture alone.
 *
 * Buttons at either end are aria-disabled rather than disabled, so a keyboard user who
 * presses Next on the last step keeps their focus.
 */
export function SteppedFigure({ title, width, height, keyItems, steps, draw }: SteppedFigureProps) {
  const stepper = useStepper(steps.length);
  const titleId = useId();
  const stepId = useId();
  const step = steps[stepper.index]!;
  const focus = new Set(step.focus ?? []);
  const stepped = steps.length > 1;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') stepper.next();
    else if (e.key === 'ArrowLeft') stepper.previous();
    else if (e.key === 'Home') stepper.go(0);
    else if (e.key === 'End') stepper.go(steps.length - 1);
    else return;
    e.preventDefault();
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-3 md:flex-row md:gap-4"
      data-figure-step={stepper.index}
    >
      {/* The column is as wide as the drawing, so the step sentence keeps a short measure. */}
      <div className="flex w-full min-w-0 flex-col gap-2 md:shrink-0" style={{ maxWidth: width }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={stepId}
          className="block h-auto max-w-full self-center"
        >
          <title id={titleId}>{title}</title>
          {draw(stepper.index, focus)}
        </svg>

        {stepped ? (
          <div className="flex flex-col gap-1">
            <div aria-hidden="true" className="flex gap-0.5" data-testid="figure-progress">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-opacity duration-200 ease-out',
                    i <= stepper.index ? 'bg-fg' : 'bg-border',
                  )}
                />
              ))}
            </div>
            <p id={stepId} aria-live="polite" className="min-h-12 text-base">
              <span className="sr-only">{`Step ${stepper.index + 1} of ${steps.length}.`}</span>{' '}
              {step.text}
            </p>
            <div
              role="group"
              aria-label="Step through the figure"
              onKeyDown={onKeyDown}
              className="flex flex-wrap items-center gap-1"
            >
              <button
                type="button"
                className={CONTROL}
                aria-disabled={stepper.atStart || undefined}
                onClick={stepper.previous}
              >
                <ChevronLeft aria-hidden size={16} strokeWidth={2} />
                Back
              </button>
              <p className="t-figure text-muted min-w-5 text-center text-sm" aria-hidden="true">
                {stepper.index + 1} / {steps.length}
              </p>
              <button
                type="button"
                className={CONTROL}
                aria-disabled={stepper.atEnd || undefined}
                onClick={stepper.next}
              >
                Next
                <ChevronRight aria-hidden size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={cn(CONTROL, 'ml-auto border-transparent')}
                onClick={stepper.playing ? stepper.pause : stepper.play}
              >
                {stepper.playing ? (
                  <Pause aria-hidden size={16} strokeWidth={2} />
                ) : stepper.atEnd ? (
                  <RotateCcw aria-hidden size={16} strokeWidth={2} />
                ) : (
                  <Play aria-hidden size={16} strokeWidth={2} />
                )}
                {stepper.playing ? 'Pause' : stepper.atEnd ? 'Replay' : 'Play'}
              </button>
            </div>
          </div>
        ) : (
          <p id={stepId} className="sr-only">
            {step.text}
          </p>
        )}
      </div>

      <ol className="flex min-w-0 flex-col self-start">
        {keyItems.map((item) => {
          const on = focus.has(item.n);
          return (
            <li
              key={item.n}
              className="rule-t flex gap-1 py-1 first:border-t-0 first:pt-0"
              aria-current={on ? 'step' : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  't-figure flex size-3 shrink-0 items-center justify-center rounded-full border text-sm font-medium',
                  on ? 'bg-fg text-bg border-fg' : 'border-fg text-fg',
                )}
              >
                {item.n}
              </span>
              <div className="flex min-w-0 flex-col">
                <p className={cn('text-sm font-medium', on ? 'text-fg' : 'text-muted')}>
                  <span className="sr-only">{item.n}. </span>
                  {item.title}
                </p>
                <p className="text-muted text-sm">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
