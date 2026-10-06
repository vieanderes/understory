/*
 * What a lab is, without its view: id, name, the question it answers and the chapter that
 * teaches it. It lives in core so the content validator and the path stages can name labs;
 * the client registry in src/features/labs adds how to load each one.
 */
export interface LabInfo {
  id: string;
  title: string;
  /** The question the lab lets you answer, in one sentence. */
  question: string;
  /** The chapter (module id) that teaches the mechanism. */
  moduleId: string;
}

/** About how long stepping through a lab takes, for a path stage's list. */
export const LAB_MINUTES = 10;

export const LAB_INFO: readonly LabInfo[] = [
  {
    id: 'box-model-explorer',
    title: 'Box model explorer',
    question:
      'How wide is this box on screen, and why is the gap between two blocks smaller than the sum of their margins?',
    moduleId: 'css',
  },
  {
    id: 'flex-grid-playground',
    title: 'Flex and grid playground',
    question: 'Where does the space left over in a row go, and why does one item refuse to shrink?',
    moduleId: 'css',
  },
  {
    id: 'request-journey',
    title: 'Request journey',
    question:
      'What happens between pressing Enter on a URL and seeing the page, and where does the time go?',
    moduleId: 'backend',
  },
  {
    id: 'event-loop-stepper',
    title: 'Event loop stepper',
    question: 'In what order does this code run, and why?',
    moduleId: 'js',
  },
  {
    id: 'btree-index-explorer',
    title: 'B-tree index explorer',
    question:
      'How does an index find a row, and when does the planner decide that reading the whole table is cheaper?',
    moduleId: 'db',
  },
  {
    id: 'isolation-anomaly-stepper',
    title: 'Isolation anomaly stepper',
    question:
      'Two transactions touch the same rows: what does each one see, and which isolation level stops the damage?',
    moduleId: 'db',
  },
  {
    id: 'cache-layer-explorer',
    title: 'Cache-layer explorer',
    question:
      'Where is this page served from, and what does each revalidation call actually reach?',
    moduleId: 'next',
  },
  {
    id: 'overselling-simulator',
    title: 'Overselling simulator',
    question:
      'Two buyers press Buy on the last ticket at the same moment: which way of writing the reservation sells it once, and what does that cost?',
    moduleId: 'scale',
  },
];

export const LAB_INFO_BY_ID: ReadonlyMap<string, LabInfo> = new Map(
  LAB_INFO.map((lab) => [lab.id, lab]),
);
