'use client';

import { createElement, lazy, Suspense, type ComponentType } from 'react';
import type { LabProps } from './contract';
import { LABS } from './registry';

/** Created once, at module load: a lazy component must not be made during a render. */
const LAB_COMPONENTS: ReadonlyMap<string, ComponentType<LabProps>> = new Map(
  LABS.map((lab) => [lab.id, lazy(lab.load)]),
);

interface LabHostProps extends LabProps {
  id: string;
}

/**
 * Loads a lab's code on demand and holds its space while it loads, so the page does not
 * jump. Used by the standalone lab page and by lab steps inside lessons.
 */
export function LabHost({ id, ...props }: LabHostProps) {
  const Lab = LAB_COMPONENTS.get(id);
  if (!Lab)
    return <p className="text-muted">This lab is not part of this version of Understory.</p>;
  return (
    <Suspense
      fallback={
        <div className="border-border bg-surface rounded-panel t-label min-h-40 border p-2">
          Loading lab
        </div>
      }
    >
      {/* The map's values are stable, module-level components chosen by id. */}
      {createElement(Lab, props)}
    </Suspense>
  );
}
