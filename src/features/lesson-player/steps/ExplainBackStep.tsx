'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CompiledExplainBackStep } from '@/core/content/compiled';
import { cn } from '@/lib/cn';
import type { StepProps } from '../contract';
import { InlineMd } from '../parts/InlineMd';
import { RichText } from '../parts/RichText';
import { StepLayout } from '../parts/StepLayout';

/** Long enough to make three points, short enough to stay one thought. */
const TARGET = { min: 30, max: 80 } as const;

const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * explain-back: say it in your own words, then compare with a model answer and mark the
 * points you made. Self-explanation is where understanding is built (Chi et al. 1994);
 * grading against a rubric keeps the self-assessment honest. The text stays in this
 * component: only the count of points made is reported.
 */
export function ExplainBackStep({
  step,
  phase,
  onSubmissionChange,
}: StepProps<CompiledExplainBackStep>) {
  const [text, setText] = useState('');
  const [compared, setCompared] = useState(false);
  const [made, setMade] = useState<readonly boolean[]>(() => step.rubric.map(() => false));
  const countId = useId();

  const checked = phase === 'checked';
  const words = wordsIn(text);
  const hits = made.filter(Boolean).length;

  function report(next: readonly boolean[]) {
    // The rubric always has three points (schema), which is what the 0..3 type says.
    const rubricHits = Math.min(3, next.filter(Boolean).length) as 0 | 1 | 2 | 3;
    onSubmissionChange({ type: 'explain-back', rubricHits });
  }

  function compare() {
    setCompared(true);
    report(made);
  }

  function toggle(index: number) {
    const next = made.map((value, i) => (i === index ? !value : value));
    setMade(next);
    report(next);
  }

  return (
    <StepLayout>
      <RichText value={step.prompt} className="t-section" />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${countId}-text`} className="t-label">
          Your explanation
        </label>
        <textarea
          id={`${countId}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Once the model answer is out, the explanation is what gets marked, as written.
          readOnly={compared}
          rows={6}
          aria-describedby={`${countId} ${countId}-aim`}
          // 16 px: iOS zooms the page when a smaller field takes focus.
          className={cn(
            'rounded-control bg-surface w-full resize-y border p-2 text-base',
            'transition-colors duration-150 ease-out',
            compared ? 'border-border text-muted' : 'border-border hover:border-faint',
          )}
        />
        <p className="text-muted flex justify-between gap-2 text-sm">
          <span id={countId} className="t-figure">
            {words} {words === 1 ? 'word' : 'words'}
          </span>
          <span id={`${countId}-aim`}>
            Aim for {TARGET.min} to {TARGET.max}
          </span>
        </p>
      </div>

      {compared ? (
        <div className="step-in flex flex-col gap-3">
          <div className="rule-t pt-2">
            <p className="t-label pb-1">Model answer</p>
            <RichText value={step.modelAnswer} />
          </div>
          <fieldset disabled={checked} className="min-w-0">
            <legend className="t-label pb-1">My explanation made this point</legend>
            <div className="flex flex-col gap-1">
              {step.rubric.map((point, i) => (
                <label
                  key={i}
                  className={cn(
                    'rounded-control flex min-h-6 items-center gap-2 border px-2 py-1 transition-colors duration-150 ease-out',
                    'has-focus-visible:outline-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                    !checked && 'cursor-pointer',
                    made[i] ? 'border-accent bg-accent-tint' : 'border-border hover:bg-raised',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={made[i] ?? false}
                    onChange={() => toggle(i)}
                    className="accent-accent size-2 shrink-0"
                  />
                  <InlineMd text={point} className="min-w-0 flex-1" />
                </label>
              ))}
            </div>
          </fieldset>
          {checked ? (
            <p role="status" className="rule-t pt-2 font-medium">
              {hits} of {step.rubric.length} points made
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={compare} disabled={words === 0}>
            Compare
          </Button>
        </div>
      )}
    </StepLayout>
  );
}
