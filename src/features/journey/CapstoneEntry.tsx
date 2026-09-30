'use client';

import { Check } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useProgress, useStore } from '@/features/store/StoreProvider';

/*
 * The decision record loads only for a capstone that has one or is built. Learn is
 * prefetched from every lesson, and the lesson route's budget
 * (tests/e2e/bundle-budget.spec.ts) has no room for it.
 */
const CapstoneAdrPanel = lazy(() =>
  import('@/features/adr/CapstoneAdrPanel').then((m) => ({ default: m.CapstoneAdrPanel })),
);

interface CapstoneEntryProps {
  partId: string;
  /** The part's place in the course, which numbers its decision record. */
  partNumber: number;
  capstone: { title: string; brief: string };
  /** Start open, as on the milestone screen. */
  open?: boolean;
}

/**
 * A small project that uses the part's skills. Building it is the learner's own claim,
 * recorded once as a fact; ranks count capstones, so it is never counted twice. Once built,
 * the learner can keep a decision record of it.
 */
export function CapstoneEntry({ partId, partNumber, capstone, open = false }: CapstoneEntryProps) {
  const store = useStore();
  const { status, state } = useProgress();
  const [saving, setSaving] = useState(false);
  const built = state.completedCapstones.has(partId);

  async function markBuilt() {
    setSaving(true);
    try {
      await store.record('capstone_completed', { moduleId: partId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details open={open} className="group rule-b" data-testid="capstone-entry">
      <summary className="flex min-h-6 cursor-pointer list-none items-baseline gap-2 py-1">
        <span className="t-label w-10 shrink-0">Capstone</span>
        <span className="min-w-0 flex-1 font-medium">{capstone.title}</span>
        <span className="t-label shrink-0">
          {built ? (
            <span className="inline-flex items-center gap-0.5">
              <Check aria-hidden size={16} strokeWidth={2} />
              Built
            </span>
          ) : (
            'Project'
          )}
        </span>
      </summary>
      <div className="flex flex-col items-start gap-2 pb-2 md:pl-12">
        <p className="text-muted prose-measure text-sm">{capstone.brief}</p>
        {built ? null : (
          <Button
            variant="secondary"
            size="md"
            onClick={() => void markBuilt()}
            loading={saving}
            disabled={status !== 'ready'}
          >
            Mark as built
          </Button>
        )}
        {built || state.capstoneAdrs[partId] ? (
          <Suspense fallback={null}>
            <CapstoneAdrPanel partId={partId} number={partNumber} level={3} />
          </Suspense>
        ) : null}
      </div>
    </details>
  );
}
