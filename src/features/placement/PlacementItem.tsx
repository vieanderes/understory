'use client';

import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActionBar } from '@/components/layout/ActionBar';
import { Button } from '@/components/ui/Button';
import type { CompiledStep } from '@/core/content/compiled';
import type { CompiledPlacementItem } from '@/core/content/placement-schema';
import { gradeStep, type Answer } from '@/core/grading';
import type { Confidence } from '@/core/progress';
import type { Submission } from '@/features/lesson-player/contract';
import { toGradable } from '@/features/lesson-player/gradable';
import { ConfidenceControl } from '@/features/lesson-player/parts/ConfidenceControl';
import { STEP_COMPONENTS } from '@/features/lesson-player/registry';
import { STEP_KIND } from '@/features/lesson-player/StepRunner';

/**
 * One placement question, played by the lesson player's own step components. Nothing is
 * marked right or wrong here: feedback between items slows placement and moves it.
 */
export function PlacementItem({
  item,
  where,
  onAnswer,
  onBack,
}: {
  item: CompiledPlacementItem;
  /** Which area this is, for example "Servers and data · area 2 of 5". */
  where: string;
  onAnswer: (correct: boolean, confidence: Confidence) => void;
  onBack: () => void;
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = item as CompiledStep;
  const StepComponent = STEP_COMPONENTS[step.type];
  const canAnswer = submission !== null && confidence !== null;

  // Focus lands where the new question starts, for keyboard and screen reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function next() {
    if (!submission || !confidence) return;
    const gradable = toGradable(step);
    if (!gradable) return;
    onAnswer(gradeStep(gradable, submission as Answer).correct, confidence);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (['TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(target.tagName)) return;
      e.preventDefault();
      next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <section aria-labelledby="step-kind" className="step-in flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="t-label text-muted">{where}</p>
          <h2 id="step-kind" ref={headingRef} tabIndex={-1} className="t-label outline-none">
            {STEP_KIND[step.type]}
          </h2>
        </div>
        {StepComponent ? (
          <StepComponent
            step={step as never}
            phase="answering"
            reveal={false}
            seed={0}
            onSubmissionChange={setSubmission}
            requestCheck={next}
          />
        ) : null}
      </section>

      {/* Like a lesson: Back alone on the left; how sure beside Next on the right, set just
          before moving on. On a phone how sure takes its own row above. */}
      <ActionBar className="flex-wrap gap-y-1 sm:flex-nowrap">
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
          <ConfidenceControl
            value={confidence}
            onChange={setConfidence}
            className="max-sm:order-first max-sm:w-full"
          />
          <Button variant="primary" onClick={next} disabled={!canAnswer} className="max-sm:ml-auto">
            Next
          </Button>
        </div>
      </ActionBar>
    </>
  );
}
