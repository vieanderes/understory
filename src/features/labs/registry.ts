import type { LabMeta } from './contract';

/**
 * Every lab this client can run. Each `load` is a dynamic import, so a lab's code is
 * fetched only when a learner opens it. Lessons refer to labs by id; a lesson whose lab
 * is not listed here shows its fallback step instead.
 */
export const LABS: readonly LabMeta[] = [
  {
    id: 'box-model-explorer',
    title: 'Box model explorer',
    question:
      'How wide is this box on screen, and why is the gap between two blocks smaller than the sum of their margins?',
    moduleId: 'css',
    load: () => import('./box-model-explorer'),
  },
  {
    id: 'flex-grid-playground',
    title: 'Flex and grid playground',
    question: 'Where does the space left over in a row go, and why does one item refuse to shrink?',
    moduleId: 'css',
    load: () => import('./flex-grid-playground'),
  },
  {
    id: 'request-journey',
    title: 'Request journey',
    question:
      'What happens between pressing Enter on a URL and seeing the page, and where does the time go?',
    moduleId: 'backend',
    load: () => import('./request-journey'),
  },
  {
    id: 'event-loop-stepper',
    title: 'Event loop stepper',
    question: 'In what order does this code run, and why?',
    moduleId: 'js',
    load: () => import('./event-loop-stepper'),
  },
  {
    id: 'btree-index-explorer',
    title: 'B-tree index explorer',
    question:
      'How does an index find a row, and when does the planner decide that reading the whole table is cheaper?',
    moduleId: 'db',
    load: () => import('./btree-index-explorer'),
  },
  {
    id: 'isolation-anomaly-stepper',
    title: 'Isolation anomaly stepper',
    question:
      'Two transactions touch the same rows: what does each one see, and which isolation level stops the damage?',
    moduleId: 'db',
    load: () => import('./isolation-anomaly-stepper'),
  },
  {
    id: 'cache-layer-explorer',
    title: 'Cache-layer explorer',
    question:
      'Where is this page served from, and what does each revalidation call actually reach?',
    moduleId: 'next',
    load: () => import('./cache-layer-explorer'),
  },
  {
    id: 'overselling-simulator',
    title: 'Overselling simulator',
    question:
      'Two buyers press Buy on the last ticket at the same moment: which way of writing the reservation sells it once, and what does that cost?',
    moduleId: 'scale',
    load: () => import('./overselling-simulator'),
  },
];

export const LAB_BY_ID: ReadonlyMap<string, LabMeta> = new Map(LABS.map((lab) => [lab.id, lab]));
