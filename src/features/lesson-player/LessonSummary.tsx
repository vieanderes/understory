'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import type { CompiledLesson } from '@/core/content/compiled';
import { partOfLesson, partProgress } from '@/core/insight';
import { useCatalog } from '@/features/catalog/useCatalog';
import { useProgress } from '@/features/store/StoreProvider';
import { localDateOf } from '@/features/store/progress-store';
import { Recap } from './parts/Recap';
import { RichText } from './parts/RichText';
import type { StepResult } from './StepRunner';
import { Title } from '@/features/motion/Title';

interface LessonSummaryProps {
  lesson: CompiledLesson;
  results: readonly StepResult[];
  next: { href: string; title: string } | null;
  exitHref: string;
  /** True when this run recorded the lesson's first completion. */
  firstCompletion?: boolean;
}

const SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

/**
 * A clear stopping point. What was shown, what comes back and when, what to read, and
 * one way onward. "Done" is always an acceptable answer.
 */
export function LessonSummary({
  lesson,
  results,
  next,
  exitHref,
  firstCompletion = false,
}: LessonSummaryProps) {
  const { state } = useProgress();
  const { catalog } = useCatalog();
  const part = catalog ? partOfLesson(catalog.parts, lesson.id) : undefined;
  // Completion counts lessons only, so concept states are not needed to know it.
  const finishedPart =
    firstCompletion && part && partProgress(part, state, () => 'unseen').complete
      ? part
      : undefined;
  const right = results.filter((r) => r.grade.correct).length;
  const xpToday = state.xpByLocalDate[localDateOf(new Date())] ?? 0;

  const lessonCards = Object.entries(state.cards).filter(([key]) => key.includes(`:${lesson.id}#`));
  const nextDue = lessonCards
    .map(([, card]) => new Date(card.due))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const references = [...lesson.references].sort(
    (a, b) => Number(b.primary ?? false) - Number(a.primary ?? false),
  );

  return (
    <section aria-labelledby="summary-title" className="step-in flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="t-label">{lesson.title}</p>
        <Title id="summary-title">Done.</Title>
      </div>

      {lesson.recap ? <Recap lines={lesson.recap} /> : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <Figure label="Right" value={String(right)} unit={`/ ${results.length}`} />
        <Figure label="XP today" value={String(Math.round(xpToday))} />
        <Figure label="Cards started" value={String(lesson.recall.length)} />
        <Figure label="Comes back" value={nextDue ? SHORT.format(nextDue) : 'Soon'} />
      </dl>

      {finishedPart ? (
        <div className="rule-t flex flex-col gap-1 pt-2" data-testid="part-finished">
          <p className="t-label">Part complete</p>
          <p className="text-lg">
            That was the last lesson of {finishedPart.title}. {finishedPart.summary}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {finishedPart ? (
          <Link href={`/milestone/${finishedPart.id}`} className={buttonClass('primary')}>
            See the milestone
          </Link>
        ) : next ? (
          <Link href={next.href} className={buttonClass('primary')}>
            Next · {next.title}
          </Link>
        ) : null}
        <Link
          href={exitHref}
          className={buttonClass(next || finishedPart ? 'secondary' : 'primary')}
        >
          Done for now
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-x-4 gap-y-4 md:grid-cols-12">
        <div className="col-span-4 md:col-span-7">
          <h2 className="t-label rule-t pt-2">Read next</h2>
          <ul className="flex flex-col gap-2 pt-2">
            <li className="text-sm">
              <p className="font-medium">
                <Link
                  href={`/lectures/${lesson.moduleSlug}/${lesson.slug}`}
                  className="inline-flex min-h-3 items-center underline underline-offset-4"
                >
                  This lesson as a lecture
                </Link>
              </p>
              <p className="text-muted">
                Every answer with its reason, the full solutions and what to remember. Also as a
                PDF.
              </p>
            </li>
            {references.map((ref) => (
              <li key={ref.title} className="text-sm">
                <p className="font-medium">
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-3 items-center gap-0.5 underline underline-offset-4"
                    >
                      {ref.title}
                      <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    ref.title
                  )}
                </p>
                <p className="text-muted">
                  {[ref.authors, ref.venue, ref.year].filter(Boolean).join(' · ')}
                  <span className="t-label pl-1">{ref.kind}</span>
                </p>
                {ref.note ? <p className="text-muted">{ref.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>

        {lesson.deepDive ? (
          <details className="col-span-4 md:col-span-5">
            <summary className="t-label rule-t flex min-h-5 cursor-pointer items-center pt-2">
              Deep dive
            </summary>
            <RichText value={lesson.deepDive} className="pt-2 text-sm" />
          </details>
        ) : null}
      </div>
    </section>
  );
}
