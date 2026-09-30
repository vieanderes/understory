'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Rich } from '@/core/content/compiled';
import { RichText } from './RichText';

export type SolutionState = 'hidden' | 'loading' | 'shown' | 'failed';

interface HintLadderProps {
  hints: readonly Rich[];
  /** How many rungs are showing. The step owns the count, because it goes into the score. */
  shown: number;
  onShowHint: () => void;
  /** Absent when the lesson ships no solutions: the last resort is then not offered. */
  onShowSolution?: () => void;
  solution: SolutionState;
  /** Once the step is checked the ladder is history: nothing more can be taken. */
  disabled?: boolean;
}

/**
 * Help in the order of least help first (LEARNING-SCIENCE.md B4): a nudge, then the
 * tool, then the shape of the answer. One rung at a time, each a decision by the
 * learner, and the price is said once and plainly. The solution is a separate, explicit
 * step behind the last hint, asked about once, because it ends the step's score.
 */
export function HintLadder({
  hints,
  shown,
  onShowHint,
  onShowSolution,
  solution,
  disabled = false,
}: HintLadderProps) {
  const [confirming, setConfirming] = useState(false);
  const latestHint = useRef<HTMLLIElement>(null);
  const solutionRow = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);

  // The pressed button changes or goes away. Focus moves to what it produced, so a
  // keyboard or screen reader user is not dropped at the top of the page.
  useEffect(() => {
    if (shown > 0) latestHint.current?.focus();
  }, [shown]);

  useEffect(() => {
    if (confirming || !returnFocus.current) return;
    returnFocus.current = false;
    solutionRow.current?.querySelector('button')?.focus();
  }, [confirming]);

  const total = hints.length;
  const allShown = shown >= total;

  return (
    <section aria-label="Hints" className="flex flex-col gap-1">
      <p className="t-label">Hints</p>

      {shown > 0 ? (
        <ol className="flex flex-col">
          {hints.slice(0, shown).map((hint, index) => (
            <li
              key={index}
              ref={index === shown - 1 ? latestHint : undefined}
              tabIndex={-1}
              data-testid="hint"
              className="rule-t step-in flex gap-1 py-1 outline-none"
            >
              <span className="t-figure text-muted w-2 shrink-0 text-sm leading-2.5">
                {index + 1}
              </span>
              <RichText value={hint} className="text-sm" />
            </li>
          ))}
        </ol>
      ) : null}

      {!allShown ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Button variant="secondary" size="md" onClick={onShowHint} disabled={disabled}>
            Hint {shown + 1} of {total}
          </Button>
          <p className="text-muted font-mono text-sm">Each hint lowers the score for this step</p>
        </div>
      ) : null}

      {allShown && onShowSolution && solution !== 'shown' ? (
        confirming ? (
          <div role="group" aria-label="Show the solution" className="flex flex-col gap-1">
            <p className="text-sm">Show the solution? This step then scores 0.</p>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setConfirming(false);
                  onShowSolution();
                }}
              >
                Show
              </Button>
              <Button
                variant="quiet"
                size="md"
                // The safe answer is the one under the finger and under Enter.
                autoFocus
                onClick={() => {
                  returnFocus.current = true;
                  setConfirming(false);
                }}
              >
                Keep trying
              </Button>
            </div>
          </div>
        ) : (
          <div ref={solutionRow} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Button
              variant="quiet"
              size="md"
              className="-ml-2"
              onClick={() => setConfirming(true)}
              disabled={disabled}
              loading={solution === 'loading'}
            >
              Show solution
            </Button>
            {solution === 'failed' ? (
              <p role="alert" className="text-sm">
                The solution did not load. Try again.
              </p>
            ) : null}
          </div>
        )
      ) : null}

      {solution === 'shown' ? (
        <p className="text-muted font-mono text-sm">Solution shown. This step scores 0.</p>
      ) : null}
    </section>
  );
}
