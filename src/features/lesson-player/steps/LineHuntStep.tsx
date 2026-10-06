'use client';

import { useMemo, useState } from 'react';
import type { CompiledAiReviewStep, CompiledBugHuntStep } from '@/core/content/compiled';
import { mulberry32, shuffle } from '@/core/util';
import type { StepProps } from '../contract';
import { ChoiceList } from '../parts/ChoiceList';
import { CodeView } from '../parts/CodeView';
import { Feedback } from '../parts/Feedback';
import { InlineMd } from '../parts/InlineMd';
import { RichText } from '../parts/RichText';
import { StepLayout } from '../parts/StepLayout';

type LineHuntData = CompiledBugHuntStep | CompiledAiReviewStep;

const FLAW: Record<CompiledAiReviewStep['flawClass'], string> = {
  logic: 'Logic',
  race: 'Race condition',
  security: 'Security',
  'hallucinated-api': 'Invented API',
  'edge-case': 'Edge case',
  performance: 'Performance',
};

const lineList = (lines: readonly number[]) =>
  `${lines.length === 1 ? 'Line' : 'Lines'} ${[...lines].sort((a, b) => a - b).join(', ')}`;

/**
 * bug-hunt and ai-review: find the faulty line, then say why it is faulty. Two stages on
 * purpose. The reasons would point at the line if they were on show from the start, and
 * naming the cause is what separates finding a bug from guessing at one.
 */
export function LineHuntStep({
  step,
  phase,
  grade,
  reveal,
  seed,
  onSubmissionChange,
}: StepProps<LineHuntData>) {
  /** Oldest first, so a pick beyond the allowed count replaces the oldest. */
  const [picked, setPicked] = useState<readonly number[]>([]);
  const [reason, setReason] = useState<number | null>(null);

  const order = useMemo(
    () =>
      shuffle(
        step.reasons.map((_, i) => i),
        mulberry32(seed),
      ),
    [step.reasons, seed],
  );

  const checked = phase === 'checked';
  const allowed = step.lines.length;

  function report(lines: readonly number[], reasonIndex: number | null) {
    onSubmissionChange(
      lines.length === allowed && reasonIndex !== null
        ? { type: step.type, lines: [...lines].sort((a, b) => a - b), reasonIndex }
        : null,
    );
  }

  function pick(line: number) {
    const next = picked.includes(line)
      ? picked.filter((n) => n !== line)
      : [...picked, line].slice(-allowed);
    setPicked(next);
    report(next, reason);
  }

  function choose(index: number) {
    setReason(index);
    report(picked, index);
  }

  const wrongPicks = picked.filter((n) => !step.lines.includes(n));
  const linesRight = wrongPicks.length === 0 && picked.length === allowed;
  const chosen = reason === null ? undefined : step.reasons[reason];

  const verdicts: Record<number, 'right' | 'wrong'> = {};
  if (checked) {
    for (const n of picked) verdicts[n] = step.lines.includes(n) ? 'right' : 'wrong';
    if (reveal) for (const n of step.lines) verdicts[n] = 'right';
  }

  return (
    <StepLayout
      question={
        <div className="flex flex-col gap-2">
          <RichText value={step.prompt} className="t-section" />
          {step.type === 'ai-review' ? (
            <div>
              <p className="t-label">Asked of the assistant</p>
              <p className="pt-0.5">
                <InlineMd text={step.request} />
              </p>
            </div>
          ) : null}
        </div>
      }
      code={
        <div
          // Enter on a line picks it. The player also listens for Enter to check the
          // answer, and would check the answer as it stood before this pick.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).closest('.line'))
              e.stopPropagation();
          }}
        >
          {/*
           * Keyed by phase: CodeView stamps button roles on pickable lines and never
           * takes them back. A fresh mount after the check leaves plain, inert lines.
           */}
          <CodeView
            key={phase}
            html={step.codeHtml}
            label={checked ? 'Code, marked' : 'Code. Pick the line at fault'}
            picked={checked ? [] : picked}
            verdicts={verdicts}
            {...(checked ? {} : { onPick: pick })}
          />
        </div>
      }
    >
      {/* The answers column opens on the count, level with the code it counts lines of. */}
      {checked ? null : (
        <p className="t-label t-figure" aria-live="polite">
          {picked.length} of {allowed} {allowed === 1 ? 'line' : 'lines'} picked
        </p>
      )}
      {picked.length > 0 ? (
        <div className="step-in flex flex-col gap-1">
          <p className="t-label">Why is it at fault</p>
          <ChoiceList
            legend="Why is it at fault"
            choices={step.reasons}
            order={order}
            selected={reason}
            onSelect={choose}
            checked={checked}
            reveal={reveal}
          />
        </div>
      ) : null}
      {checked && grade ? (
        <Feedback verdict={grade.correct ? 'right' : linesRight ? 'partly' : 'wrong'}>
          <div className="flex flex-col gap-1">
            {grade.correct ? null : (
              <p>
                {linesRight
                  ? `${lineList(picked)}: right. The reason is not.`
                  : `${lineList(wrongPicks)}: not at fault.`}
                {reveal && !linesRight
                  ? ` The fault is on ${lineList(step.lines).toLowerCase()}.`
                  : ''}
              </p>
            )}
            {/*
             * The feedback of a right reason explains the whole answer, so with a second
             * try on offer it is held back. A wrong reason's feedback names the
             * misconception and is safe to show.
             */}
            {chosen && (reveal || !chosen.correct) ? <RichText value={chosen.feedback} /> : null}
          </div>
        </Feedback>
      ) : null}
      {checked && reveal ? (
        <>
          {step.type === 'ai-review' ? (
            <p className="t-label">Flaw class · {FLAW[step.flawClass]}</p>
          ) : null}
          {step.fixHtml ? (
            <div>
              <p className="t-label pb-1">A fix</p>
              <CodeView html={step.fixHtml} label="A fix" />
            </div>
          ) : null}
        </>
      ) : null}
    </StepLayout>
  );
}
