/*
 * Figures a prose step can show, for ideas that are spatial or that happen in order: the
 * hops of a request, the queues of the event loop, a RAG pipeline told stage by stage.
 * Still figures are drawn from a lab engine, so they can never disagree with the lab they
 * come from. Stepped figures are drawn with the illustration kit and carry a sentence per
 * step. The view keeps the registry of drawings (src/features/lesson-player/figures).
 */
export const FIGURE_IDS = [
  'request-hops-cold',
  'request-hops-warm',
  'event-loop-queues',
  'rag-pipeline',
  'agent-loop',
  'tool-use-round-trip',
  'embedding-space',
  'call-stack',
  'dom-tree',
  'event-loop',
  'box-model',
  'request-response',
] as const;

export type FigureId = (typeof FIGURE_IDS)[number];
