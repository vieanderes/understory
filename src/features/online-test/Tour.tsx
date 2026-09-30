'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

/*
 * The one-minute tour the platform shows before the clock starts, step for step. Each step
 * outlines the part of the IDE it talks about; the IDE marks those parts with data-tour.
 */

export interface TourStep {
  target: string;
  title: string;
  text: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: 'timer',
    title: 'Time limit',
    text: 'The timer shows how much time you have for all the tasks in this test. If you run out of time, your latest solutions are saved and submitted automatically.',
  },
  {
    target: 'autosave',
    title: 'Autosave',
    text: 'Your solution is saved automatically as you type. When you have finished, submit it.',
  },
  {
    target: 'output',
    title: 'Adjust your window',
    text: 'Drag the dividers to resize the task, the editor and the test output. Arrow keys move a focused divider.',
  },
  {
    target: 'submit',
    title: 'Submit your solution',
    text: 'Submit ends this session for every task. You can submit only once.',
  },
  {
    target: 'accessibility',
    title: 'Accessibility mode',
    text: 'Makes code and output larger. Switch it on or off at any time.',
  },
  {
    target: 'settings',
    title: 'Editor settings',
    text: 'Light or dark theme, Vim mode and the keyboard shortcuts.',
  },
  {
    target: 'exit',
    title: 'Quit this test',
    text: 'Quitting leaves the test without submitting. The timer keeps counting down from when you started.',
  },
  {
    target: 'tasks',
    title: 'That is it',
    text: 'Read every task first, including its assumptions. Good luck.',
  },
];

interface TourProps {
  onDone: () => void;
  /** Before the test the last button says so; replayed from Help it just closes. */
  finishLabel?: string;
}

export function Tour({ onDone, finishLabel = 'Finish tour' }: TourProps) {
  const [index, setIndex] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0]!;
  const last = index === TOUR_STEPS.length - 1;

  // Marks the IDE element this step describes. A DOM attribute, not React state: the
  // target lives in another component, and the outline is CSS on that attribute.
  useEffect(() => {
    const target = document.querySelector(`[data-tour="${step.target}"]`);
    target?.setAttribute('data-tour-active', '');
    nextRef.current?.focus();
    return () => target?.removeAttribute('data-tour-active');
  }, [step.target]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDone();
      }}
      className="bg-surface text-fg rounded-panel shadow-float fixed inset-x-2 bottom-2 z-50 mx-auto flex max-w-lg flex-col gap-2 p-3 md:bottom-4"
    >
      <p className="t-label t-figure">
        Step {index + 1} of {TOUR_STEPS.length}
      </p>
      <h2 id="tour-title" className="text-lg font-semibold">
        {step.title}
      </h2>
      <p id="tour-text" className="text-muted">
        {step.text}
      </p>
      <div className="flex flex-wrap items-center gap-1 pt-1">
        <Button variant="quiet" size="md" onClick={onDone}>
          Skip this tour
        </Button>
        <span className="text-faint ml-auto hidden text-sm md:inline">
          Use the keyboard to move through
        </span>
        {index > 0 ? (
          <Button variant="secondary" size="md" onClick={() => setIndex(index - 1)}>
            Back
          </Button>
        ) : null}
        <Button
          ref={nextRef}
          variant="primary"
          size="md"
          onClick={() => (last ? onDone() : setIndex(index + 1))}
        >
          {last ? finishLabel : 'Next'}
        </Button>
      </div>
    </div>
  );
}
