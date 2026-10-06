import { LAB_INFO } from '@/core/labs/catalog';
import type { LabMeta } from './contract';

/** How to fetch each lab's view. A dynamic import, so a lab loads only when opened. */
const LOADERS: Record<string, LabMeta['load']> = {
  'box-model-explorer': () => import('./box-model-explorer'),
  'flex-grid-playground': () => import('./flex-grid-playground'),
  'request-journey': () => import('./request-journey'),
  'event-loop-stepper': () => import('./event-loop-stepper'),
  'btree-index-explorer': () => import('./btree-index-explorer'),
  'isolation-anomaly-stepper': () => import('./isolation-anomaly-stepper'),
  'cache-layer-explorer': () => import('./cache-layer-explorer'),
  'overselling-simulator': () => import('./overselling-simulator'),
};

/**
 * Every lab this client can run: the facts from the core catalogue plus a loader. Lessons
 * refer to labs by id; a lesson whose lab is not listed here shows its fallback step instead.
 */
export const LABS: readonly LabMeta[] = LAB_INFO.flatMap((info) => {
  const load = LOADERS[info.id];
  return load ? [{ ...info, load }] : [];
});

export const LAB_BY_ID: ReadonlyMap<string, LabMeta> = new Map(LABS.map((lab) => [lab.id, lab]));
