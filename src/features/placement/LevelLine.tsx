'use client';

import { ArrowRight, Gauge } from 'lucide-react';
import Link from 'next/link';
import { verdictFor, type AreaVerdict } from '@/core/placement';
import { useProgress } from '@/features/store/StoreProvider';

const VERDICT_WORDS: Readonly<Record<AreaVerdict, string>> = {
  deeper: 'go deeper in',
  mostly: 'mostly there in',
  solid: 'solid in',
};

/** "Solid in 2 parts, go deeper in 3": the last result, gaps first. */
export function standingLine(levels: readonly number[]): string {
  const counts = { deeper: 0, mostly: 0, solid: 0 };
  for (const level of levels) counts[verdictFor(level)] += 1;
  const parts = (['deeper', 'mostly', 'solid'] as const)
    .filter((v) => counts[v] > 0)
    .map((v) => `${VERDICT_WORDS[v]} ${counts[v]} ${counts[v] === 1 ? 'part' : 'parts'}`);
  const line = parts.join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * The way into placement from the places a learner decides what to do: before any check,
 * an invitation; after one, the standing it found and a way to check again, since a
 * level moves as the learner learns.
 */
export function LevelLine() {
  const { status, state } = useProgress();
  if (status !== 'ready') return null;
  const levels = Object.values(state.placementByArea).map((p) => p.level);
  const placed = levels.length > 0;
  return (
    <section aria-label="Your level" className="rule-t rule-b">
      <Link
        href="/start"
        className="hairline-row group flex min-h-7 items-center gap-2 py-1.5 transition-colors duration-150 ease-out"
      >
        <Gauge aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">
            {placed ? standingLine(levels) : 'Find your level'}
          </span>
          <span className="text-muted block text-sm">
            {placed
              ? 'Check again, or check another part'
              : 'Where you are solid, where to go deeper, where to start. From 3 minutes'}
          </span>
        </span>
        <ArrowRight
          aria-hidden
          size={16}
          strokeWidth={2}
          className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
        />
      </Link>
    </section>
  );
}
