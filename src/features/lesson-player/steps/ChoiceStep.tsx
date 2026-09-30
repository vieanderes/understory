'use client';

import { useMemo, useState } from 'react';
import type { CompiledMultipleChoiceStep, CompiledPredictStep } from '@/core/content/compiled';
import { mulberry32, shuffle } from '@/core/util';
import type { StepProps } from '../contract';
import { ChoiceList } from '../parts/ChoiceList';
import { CodeView } from '../parts/CodeView';
import { Feedback } from '../parts/Feedback';
import { RichText } from '../parts/RichText';
import { StepLayout } from '../parts/StepLayout';

type ChoiceStepData = CompiledPredictStep | CompiledMultipleChoiceStep;

/** predict-output and multiple-choice: read, commit to one answer, then learn why. */
export function ChoiceStep({
  step,
  phase,
  grade,
  reveal,
  seed,
  onSubmissionChange,
}: StepProps<ChoiceStepData>) {
  const [selected, setSelected] = useState<number | null>(null);
  // Shuffled once per seed, so the right answer is not always first as authored.
  const order = useMemo(
    () =>
      shuffle(
        step.choices.map((_, i) => i),
        mulberry32(seed),
      ),
    [step.choices, seed],
  );

  function select(index: number) {
    setSelected(index);
    onSubmissionChange({ type: step.type, choiceIndex: index });
  }

  const picked = selected === null ? undefined : step.choices[selected];

  return (
    <StepLayout
      code={
        step.codeHtml ? <CodeView html={step.codeHtml} label="Code for this question" /> : undefined
      }
    >
      <RichText value={step.question} className="t-section" />
      <ChoiceList
        legend="Your answer"
        choices={step.choices}
        order={order}
        selected={selected}
        onSelect={select}
        checked={phase === 'checked'}
        reveal={reveal}
      />
      {phase === 'checked' && grade && picked ? (
        <Feedback verdict={grade.correct ? 'right' : 'wrong'}>
          <RichText value={picked.feedback} />
        </Feedback>
      ) : null}
    </StepLayout>
  );
}
