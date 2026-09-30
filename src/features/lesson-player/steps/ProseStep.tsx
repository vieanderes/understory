import type { CompiledProseStep } from '@/core/content/compiled';
import { LessonFigure } from '../figures/LessonFigure';
import { RichText } from '../parts/RichText';

/** One idea, then on. Prose earns nothing, so there is nothing to check. */
export function ProseStep({ step }: { step: CompiledProseStep }) {
  return (
    <div className="flex flex-col gap-3">
      <RichText value={step.body} className="text-lg" />
      {step.figure ? <LessonFigure id={step.figure.id} caption={step.figure.caption} /> : null}
    </div>
  );
}
