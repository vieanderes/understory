'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { formatMinutes } from '@/core/insight';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { usePathExam } from '@/features/exam/usePathExam';
import { usePathProgress } from './usePathProgress';

/**
 * Every learning path as one row of a single list, on one grid: what it is and whether it
 * is for you, its stages in order, then its size and how far you are. Every row has the same
 * columns, so the eye can run down any one of them.
 */
export function PathsIndex({ paths }: { paths: readonly PathSummary[] }) {
  return (
    <ol
      data-arrive="stagger"
      className="border-border rounded-panel bg-surface divide-border divide-y overflow-hidden border"
    >
      {paths.map((path) => (
        <PathRow key={path.id} path={path} />
      ))}
    </ol>
  );
}

export function PathRow({ path, compact = false }: { path: PathSummary; compact?: boolean }) {
  const progress = usePathProgress(path.lessonIds);
  const finished = progress.ready && progress.nextId === undefined;
  const { passed: certified } = usePathExam(path.id);
  return (
    <li>
      <Link
        href={`/paths/${path.id}`}
        className="group hover:bg-raised grid grid-cols-4 items-start gap-x-4 gap-y-2 p-2 transition-colors duration-150 ease-out md:grid-cols-12 md:p-3"
      >
        <span
          className={cn(
            'col-span-4 flex min-w-0 flex-col gap-0.5',
            compact ? 'md:col-span-8' : 'md:col-span-6',
          )}
        >
          <span className="text-lg font-semibold tracking-tight">{path.name}</span>
          {compact ? null : <span className="text-muted">{path.decision ?? path.promise}</span>}
        </span>
        {compact ? null : (
          <ol className="text-muted col-span-4 flex flex-col gap-0.5 text-sm md:col-span-3">
            {path.stages.map((stage, i) => (
              <li key={stage.title} className="flex gap-1">
                <span className="t-figure text-faint w-1.5 shrink-0">{i + 1}</span>
                <span className="min-w-0 truncate">{stage.title}</span>
              </li>
            ))}
          </ol>
        )}
        <span className="col-span-4 flex items-center gap-2 md:col-span-4 md:col-start-9 lg:col-span-3 lg:col-start-10">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="t-figure">
                {certified
                  ? 'Certified'
                  : finished
                    ? 'Done'
                    : `${progress.done} of ${progress.total} lessons`}
              </span>
              <span className="t-figure text-muted">{formatMinutes(path.minutes)}</span>
            </span>
            <ProgressLine
              value={progress.total ? progress.done / progress.total : 0}
              label={`${path.name}: ${progress.done} of ${progress.total} lessons done`}
            />
          </span>
          <ArrowRight
            aria-hidden
            size={16}
            strokeWidth={2}
            className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
          />
        </span>
      </Link>
    </li>
  );
}
