'use client';

import { ArrowUpRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { orderByInterest, storySummary, withoutRepeatedWhy } from '@/core/news';
import { cn } from '@/lib/cn';
import type { NewsItem } from '@/lib/news';
import { hostOf } from './format';
import { useNewsInterests } from './useNewsRead';

export interface LessonLink {
  id: string;
  title: string;
  href: string;
}

interface StoryListProps {
  items: NewsItem[];
  topicLabels: Record<string, string>;
  /** Lessons that exist, by id. Ids the curriculum plans but has not published are absent. */
  lessons: Record<string, LessonLink>;
}

/**
 * An edition as a reading list: headline, what happened, why it matters, the source. Stories
 * on the learner's topics come first; the rest keep the edition's order.
 */
export function StoryList({ items, topicLabels, lessons }: StoryListProps) {
  const interests = useNewsInterests();
  const ordered = useMemo(() => orderByInterest(items, interests), [items, interests]);
  const why = useMemo(() => withoutRepeatedWhy(ordered), [ordered]);

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((item) => (
        <Story
          key={item.id}
          item={item}
          why={why.get(item.id) ?? null}
          topicLabels={topicLabels}
          lessons={lessons}
        />
      ))}
    </div>
  );
}

const linkClass =
  'hover:text-fg inline-flex min-h-5 items-center gap-0.5 underline decoration-border-strong underline-offset-4 transition-colors duration-150 ease-out';

function Story({
  item,
  why,
  topicLabels,
  lessons,
}: {
  item: NewsItem;
  why: string | null;
  topicLabels: Record<string, string>;
  lessons: Record<string, LessonLink>;
}) {
  const [open, setOpen] = useState(false);
  const moreId = useId();
  const headingId = `item-${item.id}`;
  const summary = storySummary(item);
  const topic = item.topics[0];
  const concepts = item.brief?.keyConcepts ?? [];
  const related = (item.brief?.relatedLessons ?? []).flatMap((id) => lessons[id] ?? []);
  const hasMore = concepts.length > 0 || related.length > 0;

  return (
    <article
      id={`story-${item.id}`}
      aria-labelledby={headingId}
      className="rule-t flex min-w-0 scroll-mt-12 flex-col gap-1 pt-3"
    >
      <p className="t-label">
        {topic ? (topicLabels[topic] ?? topic) : item.source.name}
        {item.brief?.generatedBy === 'llm' ? ' · AI-summarised' : null}
      </p>
      <h2 id={headingId} className="t-section prose-measure break-words">
        <a
          href={item.url}
          rel="noopener noreferrer"
          target="_blank"
          className="hover:text-muted transition-colors duration-150 ease-out"
        >
          {item.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h2>
      {summary ? <p className="text-muted prose-measure break-words">{summary}</p> : null}
      {why ? (
        <p className="prose-measure text-sm">
          <span className="font-medium">Why it matters. </span>
          <span className="text-muted">{why}</span>
        </p>
      ) : null}

      <div className="text-muted flex flex-wrap items-center gap-x-2 text-sm">
        <a href={item.url} rel="noopener noreferrer" target="_blank" className={linkClass}>
          {hostOf(item.url)}
          <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {item.discussionUrl ? (
          <a
            href={item.discussionUrl}
            rel="noopener noreferrer"
            target="_blank"
            className={linkClass}
          >
            <span className="t-figure">{item.comments ?? 0}</span> comments
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
        {hasMore ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={moreId}
            onClick={() => setOpen((value) => !value)}
            className="hover:text-fg rounded-control transition-press inline-flex h-5 items-center gap-0.5 font-medium active:scale-98"
          >
            Learn more
            <ChevronDown
              aria-hidden
              size={16}
              strokeWidth={2}
              className={cn('transition-transform duration-200 ease-out', open && 'rotate-180')}
            />
          </button>
        ) : null}
      </div>

      {hasMore && open ? (
        <div id={moreId} className="step-in flex flex-col gap-2 pb-1 text-sm">
          {concepts.length > 0 ? (
            <dl className="prose-measure flex flex-col gap-1">
              {concepts.map((concept) => (
                <div key={concept.term}>
                  <dt className="inline font-medium">{concept.term}. </dt>
                  <dd className="text-muted inline">{concept.explanation}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {related.length > 0 ? (
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="text-muted">In Understory:</span>
              {related.map((lesson) => (
                <Link key={lesson.id} href={lesson.href} className={linkClass}>
                  {lesson.title}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
