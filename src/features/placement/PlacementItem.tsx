'use client';

import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActionBar } from '@/components/layout/ActionBar';
import { Button } from '@/components/ui/Button';
import type { CompiledStep } from '@/core/content/compiled';
import type { CompiledPlacementItem } from '@/core/content/placement-schema';
import { gradeStep, type Answer, type Grade } from '@/core/grading';
import type { Confidence } from '@/core/progress';
import type { Submission } from '@/features/lesson-player/contract';
import { toGradable } from '@/features/lesson-player/gradable';
import { STEP_COMPONENTS } from '@/features/lesson-player/registry';
import { STEP_KIND } from '@/features/lesson-player/StepRunner';
import { cn } from '@/lib/cn';

const SURE: readonly { value: Confidence; label: string }[] = [
  { value: 'guess', label: 'Guess' },
  { value: 'fairly', label: 'Pretty sure' },
  { value: 'certain', label: 'Certain' },
];

/**
 * One placement question, played by the lesson player's own step components. Saying how
 * sure checks the answer, so a question is two taps; then it shows right or wrong and
 * why. Seeing the answer at once is what makes the check worth doing for its own sake,
 * and the next item is a different one, so the reveal cannot help with it.
 *
 * The full check does not name the area: the questions are mixed, and a label per
 * question would turn them back into a syllabus.
 */
export function PlacementItem({
  item,
  area,
  followUp = false,
  onAnswer,
  onBack,
}: {
  item: CompiledPlacementItem;
  /** The area, named only in the check of one area. */
  area?: string;
  /** A harder question earned by a right answer, and said so: it is a small reward. */
  followUp?: boolean;
  onAnswer: (correct: boolean, confidence: Confidence) => void;
  onBack: () => void;
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [checked, setChecked] = useState<{ grade: Grade; confidence: Confidence } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = item as CompiledStep;
  const StepComponent = STEP_COMPONENTS[step.type];

  // Focus lands where the new question starts, for keyboard and screen reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Once checked, Next is the one thing left to do.
  useEffect(() => {
    if (checked) nextRef.current?.focus();
  }, [checked]);

  function check(confidence: Confidence) {
    if (!submission || checked) return;
    const gradable = toGradable(step);
    if (!gradable) return;
    setChecked({ grade: gradeStep(gradable, submission as Answer), confidence });
  }

  function next() {
    if (checked) onAnswer(checked.grade.correct, checked.confidence);
  }

  return (
    <>
      <section aria-labelledby="step-kind" className="step-in flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          {area ? <p className="t-label text-muted">{area}</p> : null}
          <h2 id="step-kind" ref={headingRef} tabIndex={-1} className="t-label outline-none">
            {STEP_KIND[step.type]}
            {followUp ? <span className="text-muted"> · Follow-up, a harder one</span> : null}
          </h2>
        </div>
        {StepComponent ? (
          <StepComponent
            step={step as never}
            phase={checked ? 'checked' : 'answering'}
            {...(checked ? { grade: checked.grade } : {})}
            reveal={checked !== null}
            seed={0}
            onSubmissionChange={setSubmission}
            requestCheck={() => undefined}
          />
        ) : null}
      </section>

      {/* Back alone on the left. On the right, Don't know and how sure, which checks; once
          checked, only Next. On a phone how sure takes its own row above. */}
      <ActionBar className="flex-wrap gap-y-1 sm:flex-nowrap">
        {checked ? (
          <Button ref={nextRef} variant="primary" onClick={next} className="ml-auto">
            Next
          </Button>
        ) : (
          <>
            <Button
              variant="quiet"
              onClick={onBack}
              aria-label="Previous question"
              title="Previous question"
            >
              <ChevronLeft aria-hidden size={16} strokeWidth={2} />
              <span className="max-sm:sr-only">Back</span>
            </Button>
            <div className="ml-auto flex items-center gap-2 max-sm:contents">
              {/* Not knowing is an answer: it counts as a miss, and saves picking at random. */}
              <Button
                variant="quiet"
                onClick={() => onAnswer(false, 'guess')}
                className="max-sm:ml-auto"
              >
                Don’t know
              </Button>
              <SureButtons
                disabled={submission === null}
                onPick={check}
                className="max-sm:order-first max-sm:w-full"
              />
            </div>
          </>
        )}
      </ActionBar>
    </>
  );
}

/**
 * How sure, as the buttons that check the answer. Confidence is still stated before the
 * answer is shown, which is what makes a confident error stick once corrected (Butterfield
 * and Metcalfe 2001). Drawn to ConfidenceControl's measure, so lessons and placement match.
 */
function SureButtons({
  disabled,
  onPick,
  className,
}: {
  disabled: boolean;
  onPick: (value: Confidence) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Check your answer: how sure are you?"
      className={cn(
        'border-border bg-surface rounded-control grid h-6 auto-cols-fr grid-flow-col border p-0.5',
        className,
      )}
    >
      {SURE.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option.value)}
          className={cn(
            'rounded-inner flex items-center justify-center px-2 text-base font-medium whitespace-nowrap select-none',
            'transition-press text-fg hover:bg-raised active:scale-98',
            'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
            'disabled:text-faint disabled:pointer-events-none',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
