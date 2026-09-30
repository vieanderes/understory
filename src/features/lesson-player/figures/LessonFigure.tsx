'use client';

import { lazy, Suspense, type ComponentType } from 'react';
import type { FigureId } from '@/core/content/figures';

// Each drawing loads only when a step shows it: the still ones pull in a lab engine, the
// stepped ones the illustration kit. A lesson without a figure pays for neither.
const DRAWINGS: Record<FigureId, ComponentType> = {
  'request-hops-cold': lazy(() =>
    import('./RequestHops').then((m) => ({
      default: () => <m.RequestHops scenario="first-visit" />,
    })),
  ),
  'request-hops-warm': lazy(() =>
    import('./RequestHops').then((m) => ({
      default: () => <m.RequestHops scenario="second-visit" />,
    })),
  ),
  'event-loop-queues': lazy(() =>
    import('./EventLoopQueues').then((m) => ({ default: m.EventLoopQueues })),
  ),
  'rag-pipeline': lazy(() => import('./RagPipeline').then((m) => ({ default: m.RagPipeline }))),
  'agent-loop': lazy(() => import('./AgentLoop').then((m) => ({ default: m.AgentLoop }))),
  'tool-use-round-trip': lazy(() =>
    import('./ToolUseRoundTrip').then((m) => ({ default: m.ToolUseRoundTrip })),
  ),
  'embedding-space': lazy(() =>
    import('./EmbeddingSpace').then((m) => ({ default: m.EmbeddingSpace })),
  ),
  'call-stack': lazy(() => import('./CallStack').then((m) => ({ default: m.CallStack }))),
  'dom-tree': lazy(() => import('./DomTree').then((m) => ({ default: m.DomTree }))),
  'event-loop': lazy(() => import('./EventLoop').then((m) => ({ default: m.EventLoop }))),
  'box-model': lazy(() => import('./BoxModel').then((m) => ({ default: m.BoxModel }))),
  'request-response': lazy(() =>
    import('./RequestResponse').then((m) => ({ default: m.RequestResponse })),
  ),
};

/** A figure under a prose step. The caption says what to notice. */
export function LessonFigure({ id, caption }: { id: FigureId; caption: string }) {
  const Drawing = DRAWINGS[id];
  return (
    <figure
      data-figure={id}
      className="border-border bg-surface rounded-panel flex min-w-0 flex-col gap-2 border p-2"
    >
      <Suspense fallback={<div className="min-h-12" aria-hidden />}>
        <Drawing />
      </Suspense>
      <figcaption className="text-muted prose-measure rule-t pt-1 text-sm">{caption}</figcaption>
    </figure>
  );
}
