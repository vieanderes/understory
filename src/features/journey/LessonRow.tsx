import { Check } from 'lucide-react';
import Link from 'next/link';
import { InlineCode } from '@/components/ui/InlineCode';
import { cn } from '@/lib/cn';

export interface LessonRowData {
  id: string;
  title: string;
  objective?: string;
  level: 'essential' | 'advanced';
  href: string | null;
  minutes: number | null;
  /** For a woven lesson, the title of its own module. */
  wovenFrom?: string;
}

interface LessonRowProps {
  lesson: LessonRowData;
  /** Shown in the mono gutter, for example "03". Omit for a row that stands alone. */
  number?: string;
  done: boolean;
  next: boolean;
}

/**
 * One lesson, the same everywhere a lesson is listed: its time always, and the markers
 * that apply beside it, never in place of it. Next is the one accented marker, because it
 * is the thing to do; Advanced and Done are quiet.
 */
export function LessonRow({ lesson, number, done, next }: LessonRowProps) {
  const planned = lesson.href === null;
  const row = (
    <>
      {number ? <span className="t-figure text-faint w-3 shrink-0 text-sm">{number}</span> : null}
      <span className="min-w-0 flex-1">
        {lesson.wovenFrom ? <span className="t-label block">{lesson.wovenFrom}</span> : null}
        <span
          className={cn(
            'block',
            planned ? 'text-faint' : done ? 'text-muted' : 'font-medium',
            next && 'text-accent',
          )}
        >
          <InlineCode text={lesson.title} />
        </span>
        {lesson.objective ? (
          <span className={cn('block text-sm', planned ? 'text-faint' : 'text-muted')}>
            <InlineCode text={lesson.objective} />
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="t-figure text-muted text-sm" data-testid="lesson-time">
          {lesson.minutes === null ? 'In preparation' : `${lesson.minutes} min`}
        </span>
        {done || next || lesson.level === 'advanced' ? (
          <span className="t-label flex items-center gap-1">
            {done ? (
              <span className="inline-flex items-center gap-0.5">
                <Check aria-hidden size={16} strokeWidth={2} />
                Done
              </span>
            ) : null}
            {next ? <span className="text-accent">Next</span> : null}
            {lesson.level === 'advanced' ? <span>Advanced</span> : null}
          </span>
        ) : null}
      </span>
    </>
  );

  return lesson.href ? (
    <Link
      href={lesson.href}
      className="hover:bg-raised rounded-control -mx-1 flex min-h-6 items-baseline gap-2 px-1 py-1 transition-colors duration-150 ease-out"
    >
      {row}
    </Link>
  ) : (
    <div className="flex min-h-6 items-baseline gap-2 py-1">{row}</div>
  );
}
