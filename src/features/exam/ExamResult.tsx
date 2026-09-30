'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import { InlineCode } from '@/components/ui/InlineCode';
import { examStageResults, type ExamItem } from '@/core/exam';
import { Title } from '@/features/motion/Title';
import { onPath } from '@/features/paths/links';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { certificateHref, examStages, percent } from './stages';

/**
 * The end of a final exam: the score and the verdict first, then each stage with the lessons
 * behind any miss, so a "not yet" says exactly where to go back to.
 */
export function ExamResult({
  path,
  items,
  outcomes,
  right,
  total,
  passed,
  onRetake,
}: {
  path: PathSummary;
  items: readonly ExamItem[];
  /** Per item: true right, false wrong, null skipped. */
  outcomes: readonly (boolean | null)[];
  right: number;
  total: number;
  passed: boolean;
  onRetake: () => void;
}) {
  const stages = examStageResults(items, outcomes, examStages(path));
  const lessons = new Map(path.stages.flatMap((s) => s.lessons).map((l) => [l.id, l]));
  const weak = stages.filter((s) => s.weak).length;

  return (
    <section aria-labelledby="exam-result-title" className="step-in flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <p className="t-label">Final exam · {path.name}</p>
        <Title id="exam-result-title">
          {passed ? (
            <>
              Passed. <span className="text-muted">The certificate is ready.</span>
            </>
          ) : (
            <>
              Not yet. <span className="text-muted">Everything stays open.</span>
            </>
          )}
        </Title>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <Figure label="Score" value={`${percent(right, total)}%`} unit="80% passes" />
        <Figure label="Right" value={String(right)} unit={`/ ${total}`} />
      </dl>

      <div className="flex flex-col gap-2">
        <h2 className="t-section">By stage</h2>
        <p className="text-muted prose-measure text-sm">
          {weak === 0
            ? 'Every stage at 80% or more.'
            : `${weak === 1 ? 'One stage' : `${weak} stages`} under 80%. The lessons below are the ones to take again.`}
        </p>
        <ol className="border-border rounded-panel divide-border divide-y overflow-hidden border">
          {stages.map((stage) => (
            <li key={stage.title} className="flex flex-col gap-1 p-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className={cn('font-medium', stage.weak && 'text-accent')}>{stage.title}</h3>
                <p className="t-label t-figure shrink-0">
                  {stage.total === 0
                    ? 'Not asked'
                    : `${stage.right}/${stage.total}${stage.weak ? ' · Weak' : ''}`}
                </p>
              </div>
              {stage.missedLessonIds.length > 0 ? (
                <ul className="flex flex-col">
                  {stage.missedLessonIds.map((id) => {
                    const lesson = lessons.get(id);
                    if (!lesson?.href) return null;
                    return (
                      <li key={id}>
                        <Link
                          href={onPath(lesson.href, path.id)}
                          className="text-muted hover:text-fg rounded-control -mx-1 flex min-h-5 items-center px-1 text-sm underline-offset-4 transition-colors duration-150 ease-out hover:underline"
                        >
                          <InlineCode text={lesson.title} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-1">
        {passed ? (
          <Link href={certificateHref(path.id)} className={buttonClass('primary', 'lg')}>
            See the certificate
          </Link>
        ) : (
          <Link href={`/paths/${path.id}`} className={buttonClass('primary', 'lg')}>
            Back to the path
          </Link>
        )}
        <button type="button" onClick={onRetake} className={buttonClass('quiet')}>
          Sit it again
        </button>
      </div>
    </section>
  );
}
