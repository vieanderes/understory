'use client';

import { ArrowRight, ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { Ledger } from '@/components/layout/PageHead';
import { buttonClass } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { ProgressLine } from '@/components/ui/ProgressLine';
import {
  addTime,
  checkpointTime,
  formatMinutes,
  isLessonDone,
  journeyProgress,
  sumTime,
  type ConceptStateOf,
  type PartIndex,
  type PartProgress,
  type TimeTotal,
} from '@/core/insight';
import { CHECKPOINT_MINUTES, TEST_OUT_MINUTES } from '@/core/practice';
import { useOverview } from '@/features/catalog/useOverview';
import { useProgress } from '@/features/store/StoreProvider';
import type { JourneyChapterData, JourneyLessonData, JourneyPartData } from '@/lib/content/outline';
import { cn } from '@/lib/cn';
import { CapstoneEntry } from './CapstoneEntry';
import { LessonRow } from './LessonRow';
import { timeLeft, timeLine } from './time-copy';
import { useHash } from './useHash';

export interface JourneyPart extends JourneyPartData {
  /** The part's concepts in journey order, from the manifest. */
  concepts: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

const timed = (chapter: JourneyChapterData) =>
  chapter.lessons.flatMap((l) => (l.minutes === null ? [] : [{ id: l.id, minutes: l.minutes }]));

/** Where a lesson sits, for the next step and for search results. */
interface Located {
  lesson: JourneyLessonData;
  part: JourneyPart;
  chapter: JourneyChapterData;
}

/** Minimal set toggling, shared by parts and chapters. */
function useToggles(): [ReadonlySet<string>, (id: string) => void, () => void] {
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setToggled((all) => {
      const next = new Set(all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return [toggled, toggle, () => setToggled(new Set())];
}

/**
 * The course, in three layers so it never arrives all at once: the next step, then the
 * seven parts as one line each, then a part's chapters, then a chapter's lessons. Only the
 * part and the chapter you are in open by themselves; everything else is one tap away, and
 * "Open all parts" or a search shows the whole course for whoever wants it. Nothing is
 * locked: every published lesson is a link, and "Next" is advice.
 */
export function JourneyView({ parts }: { parts: JourneyPart[] }) {
  const { status, state } = useProgress();
  const { view } = useOverview();
  const hash = useHash();

  const index: PartIndex[] = useMemo(
    () =>
      parts.map((part) => ({
        id: part.id,
        title: part.title,
        summary: part.summary,
        modules: part.chapters.map((c) => c.id),
        lessons: part.chapters.flatMap((c) => c.lessons.filter((l) => l.href).map((l) => l.id)),
        concepts: part.concepts,
      })),
    [parts],
  );

  const located: Located[] = useMemo(
    () =>
      parts.flatMap((part) =>
        part.chapters.flatMap((chapter) =>
          chapter.lessons.map((lesson) => ({ lesson, part, chapter })),
        ),
      ),
    [parts],
  );

  const conceptStates = useMemo(() => new Map(view?.concepts.map((c) => [c.id, c.state])), [view]);
  const stateOf: ConceptStateOf = (id) => conceptStates.get(id) ?? 'unseen';
  const journey = journeyProgress(index, state, stateOf);
  const isDone = isLessonDone(state, index);
  const ready = status === 'ready';

  const next = ready
    ? located.find(({ lesson }) => lesson.href !== null && !isDone(lesson.id))
    : located.find(({ lesson }) => lesson.href !== null);
  const started = ready && located.some(({ lesson }) => lesson.href !== null && isDone(lesson.id));

  const partTimes = parts.map((part, i) => {
    const progress = journey.parts[i] as PartProgress;
    return addTime(
      ...part.chapters.map((chapter) => sumTime(timed(chapter), isDone)),
      checkpointTime(progress),
    );
  });
  const total = addTime(...partTimes);

  const currentPartId = ready ? (journey.current?.id ?? next?.part.id) : parts[0]?.id;
  const nextChapterId = next?.chapter.id;

  // A deep link opens what it names: a part (#part-servers) or a chapter (#js).
  const hashChapter = parts.flatMap((p) => p.chapters).find((c) => c.id === hash);
  const hashPartId = hash.startsWith('part-')
    ? hash.slice(5)
    : hashChapter
      ? parts.find((p) => p.chapters.includes(hashChapter))?.id
      : undefined;

  const [partToggles, togglePart, resetParts] = useToggles();
  const [chapterToggles, toggleChapter, resetChapters] = useToggles();
  const [allOpen, setAllOpen] = useState(false);
  const [query, setQuery] = useState('');

  const partOpen = (id: string) =>
    allOpen || id === hashPartId || (id === currentPartId) !== partToggles.has(id);
  const chapterOpen = (partId: string, chapter: JourneyChapterData) => {
    if (allOpen || chapter.id === hashChapter?.id) return true;
    const byDefault = partId === currentPartId && chapter.id === nextChapterId;
    return byDefault !== chapterToggles.has(chapter.id);
  };

  function showAll(open: boolean) {
    setAllOpen(open);
    resetParts();
    resetChapters();
  }

  const q = query.trim().toLowerCase();
  const results = q
    ? located.filter(
        ({ lesson, chapter }) =>
          lesson.title.toLowerCase().includes(q) ||
          lesson.objective.toLowerCase().includes(q) ||
          chapter.title.toLowerCase().includes(q),
      )
    : [];

  const lessonsDone = journey.parts.reduce((n, p) => n + p.lessonsDone, 0);
  const lessonsTotal = journey.parts.reduce((n, p) => n + p.lessonsTotal, 0);
  const partsComplete = journey.parts.filter((p) => p.complete).length;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="grid grid-cols-4 gap-x-4 gap-y-4 md:grid-cols-12">
        <NextStep
          next={next}
          started={started}
          ready={ready}
          isDone={isDone}
          className="col-span-4 md:col-span-7 lg:col-span-8"
        />
        <div data-arrive="rise" className="col-span-4 md:col-span-5 lg:col-span-4">
          <Ledger
            rows={[
              {
                label: 'Lessons done',
                short: 'Lessons',
                value: ready ? lessonsDone : '··',
                unit: `/ ${lessonsTotal}`,
              },
              { label: 'Time left', short: 'Left', value: formatMinutes(total.left) },
              {
                label: 'Parts complete',
                short: 'Parts',
                value: ready ? partsComplete : '··',
                unit: `/ ${parts.length}`,
              },
            ]}
            footnote={
              <p className="t-label t-figure" data-testid="journey-total">
                Whole journey · {timeLine(total)}
              </p>
            }
          />
        </div>
      </div>

      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-0.5">
            <p className="t-label">
              <span className="t-figure">{pad(parts.length)}</span> parts ·{' '}
              <span className="t-figure">{lessonsTotal}</span> lessons
            </p>
            <h2 id="overview-title" className="t-section">
              The course
            </h2>
          </div>
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <LessonSearch value={query} onChange={setQuery} />
            <button
              type="button"
              onClick={() => showAll(!allOpen)}
              className={buttonClass('secondary', 'md', 'shrink-0')}
            >
              {allOpen ? 'Close all parts' : 'Open all parts'}
            </button>
          </div>
        </div>

        {q ? (
          <SearchResults results={results} query={query} isDone={isDone} nextId={next?.lesson.id} />
        ) : (
          <ol className="rule-b flex flex-col" aria-label="Seven parts">
            {parts.map((part, i) => (
              <li key={part.id} data-arrive="rise">
                <PartSection
                  part={part}
                  total={parts.length}
                  progress={journey.parts[i] as PartProgress}
                  time={partTimes[i] as TimeTotal}
                  expanded={partOpen(part.id)}
                  current={part.id === currentPartId}
                  checkpointOffered={journey.checkpoint?.id === part.id}
                  onToggle={() => togglePart(part.id)}
                  chapterOpen={(chapter) => chapterOpen(part.id, chapter)}
                  onToggleChapter={toggleChapter}
                  isDone={isDone}
                  nextId={next?.lesson.id}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/**
 * One thing to do next, so the size of the course never stands between you and starting.
 * It is the one lit object on the page: the lesson, where it sits, and the chapter as a
 * row of ticks so the step reads as part of something short.
 */
function NextStep({
  next,
  started,
  ready,
  isDone,
  className,
}: {
  next: Located | undefined;
  started: boolean;
  ready: boolean;
  isDone: (lessonId: string) => boolean;
  className?: string;
}) {
  const panel = 'bg-surface border-border rounded-panel border p-2 sm:p-3 md:p-4';
  if (!next) {
    return ready ? (
      <section
        className={cn(panel, 'flex flex-col gap-1', className)}
        data-testid="next-step"
        data-arrive="rise"
      >
        <p className="t-label">Where you are</p>
        <p className="t-section">Every lesson is done. Practice keeps it fresh.</p>
      </section>
    ) : (
      <div className={className} />
    );
  }
  const { lesson, part, chapter } = next;
  const position = chapter.lessons.findIndex((l) => l.id === lesson.id) + 1;
  return (
    <section
      aria-labelledby="next-step-title"
      data-testid="next-step"
      data-arrive="rise"
      className={cn(panel, 'flex flex-col justify-between gap-2 sm:gap-4', className)}
    >
      <div className="flex flex-col gap-1">
        <p className="t-label flex flex-wrap justify-between gap-x-2">
          <span>
            {started ? 'Continue' : 'Start here'} · Part{' '}
            <span className="t-figure">{pad(part.number)}</span>
            <span className="hidden sm:inline"> · {chapter.title}</span>
          </span>
          <span className="t-figure">
            Lesson {pad(position)} of {pad(chapter.lessons.length)}
          </span>
        </p>
        <h2 id="next-step-title" className="t-section pt-1">
          <InlineCode text={lesson.title} />
        </h2>
        <p className="text-muted prose-measure">
          <InlineCode text={lesson.objective} />
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <ol aria-hidden className="flex gap-0.5">
          {chapter.lessons.map((l) => (
            <li
              key={l.id}
              className={cn(
                'h-0.5 flex-1 rounded-full',
                l.id === lesson.id
                  ? 'bg-accent'
                  : l.href !== null && isDone(l.id)
                    ? 'bg-fg'
                    : 'bg-border',
              )}
            />
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted hidden text-sm sm:block">
            {started
              ? 'Pick up where you stopped. One lesson at a time is the whole plan.'
              : 'One lesson, about ten minutes. It is the only step there is today.'}
          </p>
          {lesson.href ? (
            <Link href={lesson.href} className={buttonClass('primary', 'lg', 'w-full sm:w-auto')}>
              {started ? 'Continue' : 'Start'}
              {lesson.minutes === null ? '' : ` · ${lesson.minutes} min`}
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LessonSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:w-40 sm:flex-none">
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
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Closures, SQL, RAG"
          // 16 px: iOS zooms the page when a smaller control takes focus.
          className="border-border bg-surface rounded-control h-5 w-full min-w-0 border pr-1 pl-4 text-base"
        />
      </div>
    </div>
  );
}

function SearchResults({
  results,
  query,
  isDone,
  nextId,
}: {
  results: Located[];
  query: string;
  isDone: (lessonId: string) => boolean;
  nextId: string | undefined;
}) {
  return (
    <div className="rule-t flex flex-col gap-2 pt-2">
      <p className="t-label t-figure" role="status">
        {results.length === 0
          ? `No lesson matches "${query.trim()}"`
          : `${results.length} ${results.length === 1 ? 'lesson matches' : 'lessons match'}`}
      </p>
      <ul className="flex flex-col">
        {results.slice(0, 60).map(({ lesson, part, chapter }) => (
          <li key={lesson.id} className="rule-b">
            <p className="t-label pt-1">
              Part <span className="t-figure">{pad(part.number)}</span> · {chapter.title}
            </p>
            <LessonRow
              lesson={lesson}
              done={lesson.href !== null && isDone(lesson.id)}
              next={lesson.id === nextId}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PartSectionProps {
  part: JourneyPart;
  total: number;
  progress: PartProgress;
  time: TimeTotal;
  expanded: boolean;
  current: boolean;
  checkpointOffered: boolean;
  onToggle: () => void;
  chapterOpen: (chapter: JourneyChapterData) => boolean;
  onToggleChapter: (id: string) => void;
  isDone: (lessonId: string) => boolean;
  nextId: string | undefined;
}

/**
 * A part is one line until it is opened: a large number in the gutter, the title and its
 * promise, then progress and what is left. Opened, its chapters and the end-of-part steps
 * hang from the same column as the title, so the eye runs straight down.
 */
function PartSection({
  part,
  total,
  progress,
  time,
  expanded,
  current,
  checkpointOffered,
  onToggle,
  chapterOpen,
  onToggleChapter,
  isDone,
  nextId,
}: PartSectionProps) {
  const bodyId = `part-body-${part.id}`;
  return (
    <section
      id={`part-${part.id}`}
      aria-labelledby={`part-title-${part.id}`}
      data-testid="journey-part"
      data-expanded={expanded}
      className="rule-t flex flex-col"
    >
      <div className="grid grid-cols-4 gap-x-4 gap-y-2 py-3 md:grid-cols-12">
        <p
          aria-hidden
          className={cn(
            't-figure hidden text-xl md:col-span-2 md:block',
            current || progress.complete ? 'text-fg' : 'text-faint',
          )}
        >
          {pad(part.number)}
        </p>
        <div className="col-span-4 flex min-w-0 flex-col gap-0.5 md:col-span-6">
          <p className="t-label">
            Part <span className="t-figure">{pad(part.number)}</span> of{' '}
            <span className="t-figure">{pad(total)}</span>
            {current ? <span className="text-fg"> · You are here</span> : null}
            {progress.complete ? <span className="text-fg"> · Complete</span> : null}
          </p>
          <h3 id={`part-title-${part.id}`} className="t-section">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={bodyId}
              className="hover:text-accent flex w-full items-center justify-between gap-2 text-left transition-colors duration-150 ease-out"
            >
              {part.title}
              <ChevronDown
                aria-hidden
                size={20}
                strokeWidth={2}
                className={cn(
                  'text-muted shrink-0 transition-transform duration-200 ease-out md:hidden',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          </h3>
          <p className="text-muted prose-measure text-sm">{part.summary}</p>
        </div>
        <div className="col-span-4 flex min-w-0 items-end gap-2 md:col-span-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <ProgressLine
              value={progress.lessonShare}
              label={`${part.title}: ${progress.lessonsDone} of ${progress.lessonsTotal} lessons done`}
            />
            <p className="t-label t-figure" data-testid="part-time">
              <span className="text-fg">
                {progress.lessonsDone}/{progress.lessonsTotal}
              </span>{' '}
              done · {part.chapters.length} chapters · {timeLeft(time)}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            tabIndex={-1}
            aria-hidden
            className="text-muted hover:text-fg rounded-control hidden size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out md:flex"
          >
            <ChevronDown
              size={20}
              strokeWidth={2}
              className={cn('transition-transform duration-200 ease-out', expanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      <div id={bodyId} hidden={!expanded}>
        <div className="grid grid-cols-4 gap-x-4 pb-6 md:grid-cols-12">
          <div className="col-span-4 flex min-w-0 flex-col gap-4 md:col-span-10 md:col-start-3">
            <ol className="flex flex-col" aria-label={`Chapters of ${part.title}`}>
              {part.chapters.map((chapter) => (
                <li key={chapter.id} data-arrive="rise">
                  <Chapter
                    chapter={chapter}
                    expanded={chapterOpen(chapter)}
                    onToggle={() => onToggleChapter(chapter.id)}
                    isDone={isDone}
                    nextId={nextId}
                  />
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <h4 className="t-label">End of part</h4>
                <p className="text-muted text-sm">
                  A checkpoint mixes the whole part, weakest first. Nothing here is locked.
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
                <li>
                  <EndTile
                    href={`/practise/checkpoint/${part.id}`}
                    testId="checkpoint-entry"
                    label="Checkpoint"
                    meta={`about ${CHECKPOINT_MINUTES} min`}
                    title={`Mixed review of ${part.title}`}
                    note={
                      checkpointOffered
                        ? 'Every lesson is done. This holds the part together.'
                        : 'Best once the lessons are done.'
                    }
                  />
                </li>
                <li>
                  <EndTile
                    href={`/practise/test-out/${part.id}`}
                    label="Test out"
                    meta={`about ${TEST_OUT_MINUTES} min`}
                    title="Already know it?"
                    note="Score 80% and every lesson of the part counts as done."
                  />
                </li>
                <li>
                  <EndTile
                    href={`/lectures/parts/${part.id}`}
                    label="Lecture"
                    meta="PDF"
                    title="Read the whole part"
                    note="Every lesson as reading, with solutions."
                  />
                </li>
              </ul>
              <ul className="flex flex-col">
                <li className="rule-t">
                  <CapstoneEntry
                    partId={part.id}
                    partNumber={part.number}
                    capstone={part.capstone}
                  />
                </li>
                {progress.complete ? (
                  <li className="rule-b">
                    <Link
                      href={`/milestone/${part.id}`}
                      className="hover:bg-surface flex min-h-6 items-baseline gap-2 py-1 transition-colors duration-150 ease-out"
                    >
                      <span className="t-label w-10 shrink-0">Milestone</span>
                      <span className="min-w-0 flex-1 font-medium">See what you can now do</span>
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One of the steps that close a part: a label and its size, then what it is. */
function EndTile({
  href,
  label,
  meta,
  title,
  note,
  testId,
}: {
  href: string;
  label: string;
  meta: string;
  title: string;
  note: string;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="group rule-t hover:bg-surface flex h-full flex-col gap-0.5 py-2 transition-colors duration-150 ease-out"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="t-label">{label}</span>
        <span className="t-figure text-muted text-sm">{meta}</span>
      </span>
      <span className="group-hover:text-accent font-medium transition-colors duration-150 ease-out">
        {title}
      </span>
      <span className="text-muted text-sm">{note}</span>
    </Link>
  );
}

/**
 * A chapter is one line until it is opened: its number, title, time and a tick per lesson.
 * Opened, it says why it matters in one short block, then lists its lessons.
 */
function Chapter({
  chapter,
  expanded,
  onToggle,
  isDone,
  nextId,
}: {
  chapter: JourneyChapterData;
  expanded: boolean;
  onToggle: () => void;
  isDone: (lessonId: string) => boolean;
  nextId: string | undefined;
}) {
  const time = sumTime(timed(chapter), isDone);
  const done = chapter.lessons.filter((l) => l.href !== null && isDone(l.id)).length;
  const hasNext = chapter.lessons.some((l) => l.id === nextId);
  const bodyId = `chapter-body-${chapter.id}`;
  return (
    <section
      id={chapter.id}
      aria-labelledby={`chapter-${chapter.id}`}
      data-testid="journey-chapter"
      className="rule-t flex flex-col"
    >
      <div className="flex min-h-6 items-baseline gap-2 py-1">
        <span className="t-figure text-faint w-3 shrink-0 text-sm">{pad(chapter.number)}</span>
        <div className="min-w-0 flex-1">
          <h4 id={`chapter-${chapter.id}`} className="font-medium">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={bodyId}
              className="hover:text-accent flex w-full items-baseline justify-between gap-2 text-left transition-colors duration-150 ease-out"
            >
              {chapter.title}
              <ChevronDown
                aria-hidden
                size={16}
                strokeWidth={2}
                className={cn(
                  'text-muted shrink-0 self-center transition-transform duration-200 ease-out',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          </h4>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
            <p className="t-label t-figure" data-testid="chapter-time">
              {done}/{time.count} done · {timeLine(time, { count: false })}
              {hasNext ? <span className="text-accent"> · Next</span> : null}
            </p>
            <ol aria-hidden className="hidden w-24 gap-0.5 sm:flex">
              {chapter.lessons.map((l) => (
                <li
                  key={l.id}
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    l.href !== null && isDone(l.id) ? 'bg-fg' : 'bg-border',
                  )}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div id={bodyId} hidden={!expanded} className="flex flex-col gap-2 pb-3 sm:pl-5">
        <div className="bg-sunken rounded-control flex flex-col gap-1 p-2">
          <p className="prose-measure font-medium">{chapter.why}</p>
          <p className="text-muted prose-measure text-sm">{chapter.summary}</p>
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-0.5 text-sm">
            <span className="text-muted">
              <span className="t-label pr-1">You can build</span>
              {chapter.youCanBuild}
            </span>
            <Link
              href={`/lectures/${chapter.slug}`}
              className="hover:text-accent underline underline-offset-4 transition-colors duration-150 ease-out"
            >
              Read the chapter as a lecture
            </Link>
          </p>
        </div>
        <ol className="flex flex-col">
          {chapter.lessons.map((lesson, i) => (
            <li key={lesson.id} className="rule-b last:border-b-0">
              <LessonRow
                lesson={lesson}
                number={pad(i + 1)}
                done={lesson.href !== null && isDone(lesson.id)}
                next={lesson.id === nextId}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
