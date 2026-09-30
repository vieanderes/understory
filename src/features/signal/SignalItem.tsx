import { ArrowUpRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { NewsItem } from '@/lib/news';
import { cn } from '@/lib/cn';
import { hostOf } from './format';

export interface LessonLink {
  id: string;
  title: string;
  href: string;
}

interface SignalItemProps {
  item: NewsItem;
  index: number;
  topicLabels: Map<string, string>;
  /** Lessons that exist. Ids the curriculum plans but has not published are left out. */
  lessons: Map<string, LessonLink>;
  /** The lead opens the edition with its brief in full; a card keeps the brief one tap away. */
  variant?: 'lead' | 'card';
}

/**
 * One story in the fixed structure: what happened, why it matters, the concepts, where
 * Understory teaches them, and the source. The structure is the feature: every item can
 * be read in the same order, in under a minute, without leaving the page.
 */
export function SignalItem({
  item,
  index,
  topicLabels,
  lessons,
  variant = 'card',
}: SignalItemProps) {
  const brief = item.brief;
  const related = (brief?.relatedLessons ?? []).flatMap((id) => lessons.get(id) ?? []);
  const topics = item.topics.map((t) => topicLabels.get(t) ?? t).join(' · ');
  const headingId = `item-${item.id}`;
  const lead = variant === 'lead';

  const details = brief ? (
    <dl className={cn('grid grid-cols-1 gap-x-4 gap-y-2', lead && 'md:grid-cols-3')}>
      <div className="rule-t flex flex-col gap-0.5 pt-1">
        <dt className="t-label">Why it matters</dt>
        <dd className="text-sm">{brief.whyItMatters}</dd>
      </div>
      <div className="rule-t flex flex-col gap-0.5 pt-1">
        <dt className="t-label">Concepts</dt>
        <dd className="text-sm">
          <ul className="flex flex-col gap-1">
            {brief.keyConcepts.map((concept) => (
              <li key={concept.term}>
                <span className="font-medium">{concept.term}.</span>{' '}
                <span className="text-muted">{concept.explanation}</span>
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div className="rule-t flex flex-col gap-0.5 pt-1">
        <dt className="t-label">In Understory</dt>
        <dd className="text-sm">
          {related.length > 0 ? (
            <ul className="flex flex-col">
              {related.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={lesson.href}
                    className="hover:text-accent inline-flex min-h-3 items-center underline underline-offset-4 transition-colors duration-150 ease-out"
                  >
                    {lesson.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted">No lesson on this yet.</span>
          )}
          <span className="t-label block pt-1">
            {brief.generatedBy === 'llm' ? 'Summarised by a model' : 'From the source excerpt'}
          </span>
        </dd>
      </div>
    </dl>
  ) : null;

  return (
    <article
      id={headingId.replace('item-', 'story-')}
      aria-labelledby={headingId}
      data-arrive="rise"
      className={cn('flex min-w-0 scroll-mt-12 flex-col gap-2', !lead && 'rule-t pt-2')}
    >
      <p className="t-label">
        <span className="t-figure text-fg">{String(index).padStart(2, '0')}</span> ·{' '}
        {topics || item.source.name}
      </p>
      <h2 id={headingId} className={lead ? 't-title' : 't-section'}>
        <a
          href={item.url}
          rel="noopener noreferrer"
          target="_blank"
          className="hover:text-accent transition-colors duration-150 ease-out"
        >
          {item.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h2>
      {brief ? (
        <p className={cn('text-muted prose-measure', !lead && 'text-sm')}>{brief.whatHappened}</p>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1 text-sm">
        <a
          href={item.url}
          rel="noopener noreferrer"
          target="_blank"
          className="hover:text-accent inline-flex min-h-3 items-center gap-0.5 font-medium underline underline-offset-4 transition-colors duration-150 ease-out"
        >
          {hostOf(item.url)}
          <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {item.discussionUrl ? (
          <>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <a
              href={item.discussionUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="text-muted hover:text-fg inline-flex min-h-3 items-center underline underline-offset-4 transition-colors duration-150 ease-out"
            >
              <span className="t-figure pr-0.5">{item.comments ?? 0}</span> comments
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </>
        ) : null}
      </p>

      {details && lead ? <div className="hidden pt-2 md:block">{details}</div> : null}
      {details ? (
        // A phone keeps every brief one tap away, the lead's too, so the stories stay close.
        <details className={cn('group', lead && 'md:hidden')}>
          <summary className="text-muted hover:text-fg flex min-h-5 cursor-pointer list-none items-center gap-1 text-sm font-medium transition-colors duration-150 ease-out">
            Why it matters
            <ChevronDown
              aria-hidden
              size={16}
              strokeWidth={2}
              className="transition-transform duration-200 ease-out group-open:rotate-180"
            />
          </summary>
          <div className="pt-1 pb-1">{details}</div>
        </details>
      ) : null}
    </article>
  );
}
