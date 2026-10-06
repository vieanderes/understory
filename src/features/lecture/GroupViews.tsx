import Link from 'next/link';
import type { CompiledCapstoneSolution } from '@/core/content/compiled';
import type { LessonLecture } from '@/core/lecture';
import type { LectureChapter } from '@/lib/content';
import { LessonLectureView } from './LessonLectureView';
import { deeper, Heading, readingTime, RememberBox, RichHtml, type Level } from './parts';

/*
 * Chapters, parts and the capstone as reading. The same views serve the pages and the
 * print documents the PDFs come from; only the heading level changes with the nesting.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** A chapter's lessons in full, then every sentence to remember from them, by lesson. */
export function ChapterBody({
  chapter,
  lessons,
  level,
  pageBreaks = false,
}: {
  chapter: LectureChapter;
  lessons: readonly LessonLecture[];
  /** Heading level of each lesson title. */
  level: Level;
  pageBreaks?: boolean;
}) {
  return (
    <div className="flex flex-col gap-12">
      {lessons.map((lecture, i) => (
        <div key={lecture.id} className={pageBreaks && i > 0 ? 'lecture-page-break' : undefined}>
          <LessonLectureView
            lecture={lecture}
            level={level}
            number={pad(i + 1)}
            context={chapter.title}
          />
        </div>
      ))}
      <ChapterRecap chapter={chapter} lessons={lessons} level={level} pageBreak={pageBreaks} />
    </div>
  );
}

/** The revision sheet: every lesson's remember list on one page. */
export function ChapterRecap({
  chapter,
  lessons,
  level,
  pageBreak,
}: {
  chapter: LectureChapter;
  lessons: readonly LessonLecture[];
  level: Level;
  pageBreak?: boolean;
}) {
  const withLines = lessons.filter((lesson) => lesson.remember.length > 0);
  if (withLines.length === 0) return null;
  const id = `recap-${chapter.id}`;
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 ${pageBreak ? 'lecture-page-break' : 'rule-t pt-4'}`}
    >
      <div className="flex flex-col gap-1">
        <p className="t-label">Revision sheet</p>
        <Heading level={level} id={id} className="t-section">
          Everything to remember from {chapter.title}
        </Heading>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {withLines.map((lesson) => (
          <RememberBox
            key={lesson.id}
            items={lesson.remember}
            title={lesson.title}
            level={deeper(level)}
          />
        ))}
      </div>
    </section>
  );
}

/** The worked solution of a part's project. */
export function CapstoneView({
  title,
  brief,
  solution,
  level,
  display = false,
}: {
  title: string;
  brief: string;
  solution: CompiledCapstoneSolution | undefined;
  level: Level;
  /** Set in the title face, where the project opens a new stretch of a document. */
  display?: boolean;
}) {
  const section = deeper(level);
  const id = `capstone-${solution?.partId ?? 'brief'}`;
  return (
    <section aria-labelledby={id} className="lecture-capstone flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="t-label">Project · worked solution</p>
        <Heading level={level} id={id} className={display ? 't-title' : 't-section'}>
          {title}
        </Heading>
      </div>
      <div className="flex flex-col gap-1">
        <p className="t-label">The brief</p>
        <p className="prose-measure">{brief}</p>
      </div>
      {solution ? (
        <>
          <div className="flex flex-col gap-2">
            <Heading level={section} className="t-label">
              The shape of the solution
            </Heading>
            <RichHtml value={solution.summary} className="lecture-prose text-lg" />
          </div>
          <RememberBox items={solution.remember} title="Decisions to remember" level={section} />
          {solution.sections.map((part, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Heading level={section} className="t-section rule-t pt-3">
                <RichHtml value={part.title} inline />
              </Heading>
              <RichHtml value={part.body} className="lecture-prose" />
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <Heading level={section} className="t-section rule-t pt-3">
              Before you call it done
            </Heading>
            <ul className="flex flex-col">
              {solution.checklist.map((line, i) => (
                <li key={i} className="rule-b flex gap-2 py-1">
                  <span className="t-figure text-muted w-3 shrink-0 text-sm">{pad(i + 1)}</span>
                  <RichHtml value={line} inline />
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="text-muted text-sm">The worked solution for this project is being written.</p>
      )}
    </section>
  );
}

/** A chapter as one row of a list: what it is, how long it reads, and where to go. */
export function ChapterRow({
  chapter,
  minutes,
  actions,
}: {
  chapter: LectureChapter;
  minutes: number | undefined;
  actions?: React.ReactNode;
}) {
  return (
    // The whole row opens the chapter; its actions sit above that layer.
    <div className="hairline-row group rule-b relative flex items-center justify-between gap-2 py-1 sm:gap-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="t-figure text-faint w-3 shrink-0 text-sm">{pad(chapter.number)}</span>
        <div className="min-w-0">
          <Link
            href={`/lectures/${chapter.slug}`}
            className="focus-visible:outline-accent rounded-control font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {chapter.title}
          </Link>
          <p className="t-label t-figure">
            {chapter.lessonIds.length} lessons
            {minutes === undefined ? '' : ` · ${readingTime(minutes)}`}
          </p>
        </div>
      </div>
      {actions ? <div className="relative z-10 flex shrink-0 gap-1">{actions}</div> : null}
    </div>
  );
}

/** A worked project in brief: its shape, its decisions and what a reviewer checks. */
export function CapstoneSummary({
  partId,
  title,
  brief,
  solution,
  level,
}: {
  partId: string;
  title: string;
  brief: string;
  solution: CompiledCapstoneSolution | undefined;
  level: Level;
}) {
  const id = `fast-capstone-${partId}`;
  return (
    <article id={id} aria-labelledby={`${id}-title`} className="rule-t flex flex-col gap-3 pt-4">
      <div className="flex flex-col gap-1">
        <p className="t-label">Worked project</p>
        <Heading level={level} id={`${id}-title`} className="t-section">
          {title}
        </Heading>
      </div>
      {solution ? (
        <>
          <RichHtml value={solution.summary} className="lecture-prose" />
          <RememberBox
            items={solution.remember}
            title="Decisions to remember"
            level={deeper(level)}
          />
          <div className="flex flex-col gap-1">
            <p className="t-label text-fg">What a reviewer checks</p>
            <ul className="flex flex-col">
              {solution.checklist.map((line, i) => (
                <li key={i} className="rule-b flex gap-2 py-1">
                  <span className="t-figure text-muted w-3 shrink-0 text-sm">{pad(i + 1)}</span>
                  <RichHtml value={line} inline />
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="prose-measure">{brief}</p>
      )}
      <p className="text-sm">
        <Link
          href={`/lectures/parts/${partId}#capstone-${partId}`}
          className="text-muted hover:text-fg underline underline-offset-4 transition-colors duration-150 ease-out"
        >
          The full worked solution, with every file
        </Link>
      </p>
    </article>
  );
}
