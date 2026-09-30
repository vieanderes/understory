import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { CompiledStep } from '@/core/content/compiled';
import type { StepProps } from './contract';
import { LABS } from '@/features/labs/registry';
import { ChoiceStep } from './steps/ChoiceStep';
import { ExplainBackStep } from './steps/ExplainBackStep';
import { FillBlankStep } from './steps/FillBlankStep';
import { LabCheckpointStep } from './steps/LabCheckpointStep';
import { LineHuntStep } from './steps/LineHuntStep';
import { ParsonsStep } from './steps/ParsonsStep';
import { TraceTableStep } from './steps/TraceTableStep';

/*
 * Step type to component. A type without an entry is skipped by the player with a plain
 * note, so a lesson written for a newer client still plays on an older one.
 * Prose is rendered by the player directly: it has no answer and no phases.
 */
type AnyStepComponent = ComponentType<StepProps<never>>;

// The playground brings the page builder, the probe and the tree view. Only lessons that
// have one download it, so the lesson route stays in its budget (bundle-budget.spec.ts).
const loadPlayground = () => import('./steps/PlaygroundStep').then((m) => m.PlaygroundStep);
const PlaygroundStep = dynamic(loadPlayground);

// The code challenge brings the editor's frame, the draft store and the test results, and
// through them the lazy editor itself. A lesson that is read, not written, never loads it;
// the player fetches it one step ahead (preloadStep), so it is there when the step is.
const loadCodeChallenge = () =>
  import('./steps/CodeChallengeStep').then((m) => m.CodeChallengeStep);
const CodeChallengeStep = dynamic(loadCodeChallenge);

// The sql step brings the result tables and the client of the Postgres worker; Postgres
// itself is a worker file fetched on the first sql step (src/adapters/sql/).
const loadSql = () => import('./steps/SqlStep').then((m) => m.SqlStep);
const SqlStep = dynamic(loadSql);

const PRELOAD: Partial<Record<CompiledStep['type'], () => Promise<unknown>>> = {
  'code-challenge': loadCodeChallenge,
  playground: loadPlayground,
  sql: loadSql,
};

/** Starts fetching a step's own chunk, if it has one, before the step is on screen. */
export function preloadStep(type: CompiledStep['type'] | undefined): void {
  const load = type ? PRELOAD[type] : undefined;
  // A failed fetch is retried when the step renders, and says so there.
  if (load) void load().catch(() => undefined);
}

export const STEP_COMPONENTS: Partial<Record<CompiledStep['type'], AnyStepComponent>> = {
  'predict-output': ChoiceStep as AnyStepComponent,
  'multiple-choice': ChoiceStep as AnyStepComponent,
  'trace-table': TraceTableStep as AnyStepComponent,
  'fill-blank': FillBlankStep as AnyStepComponent,
  parsons: ParsonsStep as AnyStepComponent,
  'bug-hunt': LineHuntStep as AnyStepComponent,
  'ai-review': LineHuntStep as AnyStepComponent,
  'code-challenge': CodeChallengeStep as AnyStepComponent,
  'explain-back': ExplainBackStep as AnyStepComponent,
  // Reached only for a lab listed in LAB_IDS; any other lab plays its fallback step.
  lab: LabCheckpointStep as AnyStepComponent,
  playground: PlaygroundStep as AnyStepComponent,
  sql: SqlStep as AnyStepComponent,
};

/** Labs this client can run. A lesson whose lab is not here plays its fallback step. */
export const LAB_IDS: ReadonlySet<string> = new Set(LABS.map((lab) => lab.id));
