'use client';

import { useMemo, useState } from 'react';
import type { CompiledLabStep } from '@/core/content/compiled';
import { mulberry32, shuffle } from '@/core/util';
import type { StepProps } from '../contract';
import { ChoiceList } from '../parts/ChoiceList';
import { Feedback } from '../parts/Feedback';
import { RichText } from '../parts/RichText';
import { LabHost as RegisteredLabHost } from '@/features/labs/LabHost';
import { StepLayout } from '../parts/StepLayout';

export interface LabHostProps {
  /** The registered lab id, e.g. `event-loop`. */
  lab: string;
  preset?: Record<string, unknown>;
}

/**
 * Where a lab widget mounts inside a lesson. The real host loads the lab's code on demand
 * and holds its space while it loads, so the question below does not jump.
 */
export function LabHost({ lab, preset }: LabHostProps) {
  return <RegisteredLabHost id={lab} preset={preset} embedded />;
}

interface LabCheckpointProps extends StepProps<CompiledLabStep> {
  /** The lab widget. Defaults to the placeholder host. */
  children?: React.ReactNode | ((host: LabHostProps) => React.ReactNode);
}

/**
 * lab: explore a live model, then answer one question about what it showed. The player
 * only mounts this when the lab is registered; otherwise it plays the step's fallback.
 */
export function LabCheckpointStep({
  step,
  phase,
  grade,
  reveal,
  seed,
  onSubmissionChange,
  children,
}: LabCheckpointProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const checkpoint = step.checkpoint;
  const order = useMemo(
    () =>
      shuffle(
        (checkpoint?.choices ?? []).map((_, i) => i),
        mulberry32(seed),
      ),
    [checkpoint, seed],
  );

  function select(index: number) {
    setSelected(index);
    onSubmissionChange({ type: 'lab', choiceIndex: index });
  }

  const host: LabHostProps = { lab: step.lab, ...(step.preset ? { preset: step.preset } : {}) };
  const picked = selected === null ? undefined : checkpoint?.choices[selected];

  return (
    <StepLayout>
      <RichText value={step.intro} />
      {typeof children === 'function' ? children(host) : (children ?? <LabHost {...host} />)}
      {checkpoint ? (
        <>
          <RichText value={checkpoint.question} className="t-section" />
          <ChoiceList
            legend="Your answer"
            choices={checkpoint.choices}
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
        </>
      ) : null}
    </StepLayout>
  );
}
