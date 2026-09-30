import type { StepType } from './schema';

/*
 * Apart from the lesson schema for the same reason as ids.ts: the progress reducer needs
 * this table on every page.
 */

/** The evidence family a step belongs to. Mastery caps depend on it (LEARNING-SCIENCE B4). */
export type FormatFamily = 'recognise' | 'arrange' | 'produce';

export const FORMAT_FAMILY: Record<Exclude<StepType, 'prose'>, FormatFamily> = {
  'predict-output': 'recognise',
  'multiple-choice': 'recognise',
  'trace-table': 'arrange',
  'fill-blank': 'arrange',
  parsons: 'arrange',
  'bug-hunt': 'arrange',
  'ai-review': 'arrange',
  lab: 'recognise',
  'code-challenge': 'produce',
  'explain-back': 'produce',
  incident: 'produce',
  playground: 'produce',
  sql: 'produce',
};
