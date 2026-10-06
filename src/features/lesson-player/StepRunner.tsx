'use client';

import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CompiledStep } from '@/core/content/compiled';
import { gradePlayground, gradeRun, gradeStep, type Answer, type Grade } from '@/core/grading';
import type { Confidence, Mode } from '@/core/progress';
import { requestPersistence } from '@/features/store/client';
import { useStore } from '@/features/store/StoreProvider';
import type { Submission } from './contract';
import { toGradable } from './gradable';
import { recordOutcome } from './outcome';
import { ConfidenceControl } from './parts/ConfidenceControl';
import { ActionBar } from '@/components/layout/ActionBar';
import { STEP_COMPONENTS } from './registry';
import { ProseStep } from './steps/ProseStep';

export interface StepResult {
  stepId: string;
  concept: string;
  type: CompiledStep['type'];
  grade: Grade;
}

interface StepRunnerProps {
  lessonId: string;
  step: CompiledStep;
  mode: Mode;
  context: 'lesson' | 'practice' | 'test-out' | 'probe';
  /** Where the reference solutions of this lesson live, for code challenges. */
  solutionsUrl?: string;
  /** Called once the attempt is over and recorded (never for prose). */
  onResult: (result: StepResult) => void;
  /** Called when the learner moves on. */
  onContinue: () => void;
  /** Goes to the previous step. Absent on the first step. */
  onBack?: () => void;
}

export const STEP_KIND: Record<CompiledStep['type'], string> = {
  prose: 'Read',
  'predict-output': 'Predict',
  'multiple-choice': 'Choose',
  'trace-table': 'Trace',
  'fill-blank': 'Complete',
  parsons: 'Arrange',
  'bug-hunt': 'Find the bug',
  'ai-review': 'Review the assistant',
  'code-challenge': 'Write · Unplugged',
  'explain-back': 'Explain',
  lab: 'Lab',
  incident: 'Incident',
  playground: 'Build · Live',
  sql: 'Query · Live',
};

/** A stable number from a string, so a step shuffles the same way on every visit. */
function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A two-way choice gives the answer away once wrong, so there is nothing to retry. */
function isRetryable(step: CompiledStep): boolean {
  if (step.type === 'predict-output' || step.type === 'multiple-choice')
    return step.choices.length > 2;
  return [
    'trace-table',
    'fill-blank',
    'parsons',
    'bug-hunt',
    'ai-review',
    'playground',
    'sql',
  ].includes(step.type);
}

function toCodeStep(step: Extract<CompiledStep, { type: 'code-challenge' }>) {
  return {
    type: 'code-challenge' as const,
    id: step.id,
    concept: step.concept,
    difficulty: step.difficulty,
    prompt: step.prompt.md,
    language: step.language,
    starter: 'starter.ts',
    solution: 'solution.ts',
    tests: 'tests.ts',
    hints: step.hints.map((h) => h.md),
  };
}

/**
 * One attempt at one step, wherever it appears: in a lesson, in practice, in a test-out.
 * Commit to an answer and a confidence, check, read why, optionally try once more, move
 * on. The fact is written when the attempt ends, never before, so a second try is one
 * event with tryNumber 2 and not two events.
 *
 * Mount it with `key={step.id}`: every piece of state here belongs to one step.
 */
export function StepRunner({
  lessonId,
  step,
  mode,
  context,
  solutionsUrl,
  onResult,
  onContinue,
  onBack,
}: StepRunnerProps) {
  const store = useStore();
  const [phase, setPhase] = useState<'answering' | 'checked'>('answering');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [tryNumber, setTryNumber] = useState(1);
  const [gaveUp, setGaveUp] = useState(false);
  const startedAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const StepComponent = STEP_COMPONENTS[step.type];
  // A playground or sql step without checks is a sandbox to explore, and so is a lab
  // without a checkpoint: there is nothing to check, only to continue.
  const sandbox = (step.type === 'playground' || step.type === 'sql') && step.checks === undefined;
  const scored =
    step.type !== 'prose' &&
    StepComponent !== undefined &&
    !(step.type === 'lab' && step.checkpoint === undefined) &&
    !sandbox;
  // Code is checked when its tests pass, or when the learner has asked for the solution.
  // A failing run is not an answer: the learner keeps working, takes a hint, or skips.
  const isCode = step.type === 'code-challenge';
  const codeReady =
    submission?.type === 'code-challenge' &&
    (submission.result.status === 'passed' || submission.revealed);
  const canCheck = isCode ? codeReady : submission !== null;
  const canRetry =
    phase === 'checked' &&
    grade !== null &&
    !grade.correct &&
    tryNumber === 1 &&
    !gaveUp &&
    isRetryable(step);

  // Focus lands where the new content starts, for keyboard and screen reader users.
  useEffect(() => {
    startedAt.current = performance.now();
    headingRef.current?.focus();
  }, []);

  const finish = useCallback(
    async (finalGrade: Grade, finalSubmission: Submission | null) => {
      if (step.type === 'prose' || step.concept === undefined) return;
      const run = finalSubmission?.type === 'code-challenge' ? finalSubmission : null;
      const play =
        finalSubmission?.type === 'playground' || finalSubmission?.type === 'sql'
          ? finalSubmission
          : null;
      const explain = finalSubmission?.type === 'explain-back' ? finalSubmission : null;
      await recordOutcome(
        store,
        {
          lessonId,
          step,
          grade: finalGrade,
          tryNumber,
          hintsUsed: run?.hintsUsed ?? play?.hintsUsed ?? 0,
          revealed: run?.revealed ?? false,
          confidence,
          mode,
          context,
          durationMs: performance.now() - startedAt.current,
          ...(explain ? { rubricHits: explain.rubricHits } : {}),
        },
        new Date(),
      );
      onResult({ stepId: step.id, concept: step.concept, type: step.type, grade: finalGrade });
      void requestPersistence();
    },
    [step, store, lessonId, tryNumber, confidence, mode, context, onResult],
  );

  function check() {
    if (!submission) return;
    let result: Grade | null = null;
    if (submission.type === 'code-challenge') {
      if (step.type === 'code-challenge') result = gradeRun(toCodeStep(step), submission.result);
    } else if (submission.type === 'playground') {
      if (step.type === 'playground')
        result = gradePlayground(step.checks ?? [], submission.results);
    } else if (submission.type === 'sql') {
      // Graded by the step, so the grader stays in the step's own chunk (bundle-budget.spec.ts).
      result = submission.grade;
    } else {
      const gradable = toGradable(step);
      if (gradable) result = gradeStep(gradable, submission as Answer);
    }
    if (!result) return;
    setGrade(result);
    setPhase('checked');
    const retryOffered = !result.correct && tryNumber === 1 && isRetryable(step);
    if (!retryOffered) void finish(result, submission);
  }

  function retry() {
    setTryNumber(2);
    setPhase('answering');
    setSubmission(null);
    setGrade(null);
  }

  /** The learner declines the second try. The attempt ends here and the answer is shown. */
  function showAnswer() {
    setGaveUp(true);
    if (grade) void finish(grade, submission);
  }

  // Enter checks or continues, the way a form would.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // A step that handled the key itself (picking a code line) has the final word.
      if (e.defaultPrevented) return;
      if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (['TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(target.tagName)) return;
      if (target.isContentEditable || target.closest('.cm-editor')) return;
      e.preventDefault();
      if (!scored) onContinue();
      else if (canRetry) retry();
      else if (phase === 'checked') onContinue();
      else if (canCheck) check();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <section aria-labelledby="step-kind" className="step-advance flex flex-col gap-3">
        <h2 id="step-kind" ref={headingRef} tabIndex={-1} className="t-label outline-none">
          {sandbox ? 'Try it · Live' : STEP_KIND[step.type]}
          {tryNumber > 1 ? ' · Second try' : ''}
        </h2>
        {step.type === 'prose' ? (
          <ProseStep step={step} />
        ) : StepComponent ? (
          <StepComponent
            // A second try is a fresh mount: new shuffle, empty input.
            key={tryNumber}
            step={step as never}
            lessonId={lessonId}
            phase={phase}
            grade={grade ?? undefined}
            reveal={phase === 'checked' && !canRetry}
            tryNumber={tryNumber}
            seed={seedOf(`${lessonId}#${step.id}`) + tryNumber}
            solutionsUrl={solutionsUrl}
            onSubmissionChange={setSubmission}
            requestCheck={check}
          />
        ) : (
          <p className="text-muted">
            This step needs a newer version of Understory. It is skipped.
          </p>
        )}
      </section>

      {/* A phone takes two rows: how sure, then the buttons. Wider, one row. */}
      <ActionBar className="flex-wrap justify-between gap-y-1 sm:flex-nowrap">
        {scored && phase === 'answering' && step.type !== 'explain-back' ? (
          <ConfidenceControl
            value={confidence}
            onChange={setConfidence}
            className="w-full sm:w-auto sm:min-w-36"
          />
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {onBack ? (
            <Button
              variant="quiet"
              onClick={onBack}
              aria-label="Previous step"
              title="Previous step"
            >
              <ChevronLeft aria-hidden size={16} strokeWidth={2} />
              <span className="max-sm:sr-only">Back</span>
            </Button>
          ) : null}
          {!scored ? (
            <Button variant="primary" onClick={onContinue}>
              Continue
            </Button>
          ) : phase === 'answering' ? (
            <>
              {/* Any question can wait: nothing in Understory is locked, and a skipped
                    step simply earns nothing until it is answered. */}
              <Button variant="quiet" onClick={onContinue}>
                Skip for now
              </Button>
              <Button variant="primary" onClick={check} disabled={!canCheck}>
                Check
              </Button>
            </>
          ) : canRetry ? (
            <>
              <Button variant="quiet" onClick={showAnswer}>
                Show answer
              </Button>
              <Button variant="primary" onClick={retry}>
                Try again
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={onContinue}>
              Continue
            </Button>
          )}
        </div>
      </ActionBar>
    </>
  );
}
