'use client';

import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { InlineCode } from '@/components/ui/InlineCode';
import { useProgress } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import type { CourseTree } from './custom';

/** Lessons whose title, goal or chapter holds every word typed, in course order. */
function search(tree: CourseTree, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return tree.parts.flatMap((part) =>
    part.chapters.flatMap((chapter) =>
      chapter.lessons
        .filter((lesson) => {
          const text = `${lesson.title} ${lesson.objective} ${chapter.title}`.toLowerCase();
          return words.every((w) => text.includes(w));
        })
        .map((lesson) => ({ lesson, chapter: chapter.title, part: part.title })),
    ),
  );
}

/**
 * Any lesson in the course, found from Learn: a field, and hairline rows under it as you
 * type. The whole course, part by part, is one link away for browsing.
 */
export function FindLesson({ tree }: { tree: CourseTree }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const { state } = useProgress();
  const results = search(tree, query);
  const shown = results.slice(0, 8);
  return (
    <section aria-label="Search the course" className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:max-w-50">
          <label htmlFor={id} className="t-label">
            Find a lesson
          </label>
          <div className="relative">
            <Search
              aria-hidden
              size={16}
              strokeWidth={2}
              className="text-muted pointer-events-none absolute top-1/2 left-1 -translate-y-1/2"
            />
            <input
              id={id}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Closures, SQL, RAG"
              // 16 px: iOS zooms the page when a smaller control takes focus.
              className="border-border bg-surface rounded-control h-5 w-full min-w-0 border pr-1 pl-4 text-base"
            />
          </div>
        </div>
        <Link
          href="/learn"
          className="text-muted hover:text-fg inline-flex min-h-5 items-center gap-0.5 text-sm font-medium transition-colors duration-150 ease-out"
        >
          Browse the whole course
          <ArrowRight aria-hidden size={16} strokeWidth={2} />
        </Link>
      </div>
      {query.trim() ? (
        <div className="flex flex-col pt-1">
          <p className="t-label t-figure pb-1" role="status">
            {results.length === 0
              ? `No lesson matches "${query.trim()}"`
              : results.length > shown.length
                ? `${results.length} lessons match, the first ${shown.length} shown`
                : `${results.length} ${results.length === 1 ? 'lesson matches' : 'lessons match'}`}
          </p>
          <ul className="rule-b flex flex-col">
            {shown.map(({ lesson, chapter, part }) => {
              const done = state.completedLessons.has(lesson.id);
              return (
                <li key={lesson.id} className="rule-t">
                  <Link
                    href={lesson.href}
                    className="hairline-row group flex items-baseline gap-2 py-1.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn('font-medium', done && 'text-muted')}>
                        <InlineCode text={lesson.title} />
                      </span>
                      <span className="text-muted text-sm">
                        {part} · {chapter}
                      </span>
                    </span>
                    <span className="t-figure text-muted shrink-0 text-sm">
                      {done ? 'Done' : `${lesson.minutes} min`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
