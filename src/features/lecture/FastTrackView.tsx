import Link from 'next/link';
import type { LessonLecture } from '@/core/lecture';
import type { CompiledGuide } from '@/core/content/compiled';
import type { FastTrackLecture, LectureChapter } from '@/lib/content';
import { CapstoneSummary } from './GroupViews';
import { deeper, Heading, RememberBox, RichHtml, TermsTable, type Level } from './parts';

/*
 * The interview fast track: a plan across the course where each lesson is cut to what an
 * interview asks for. The same views serve the page and the print document.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** The first paragraph of rendered markdown: the key idea of a summary. */
const firstParagraph = (html: string): string => /<p>[\s\S]*?<\/p>/.exec(html)?.[0] ?? html;

export const dayAnchor = (i: number) => `day-${i + 1}`;

/** One lesson, condensed: key idea, remember, interview answers, top three mistakes. */
export function FastLesson({
  lesson,
  priority,
  chapter,
  level,
  depth = false,
}: {
  lesson: LessonLecture;
  priority: 'Must' | 'Should';
  chapter: LectureChapter | undefined;
  level: Level;
  /** Also show the lesson's depth sections, with their code. */
  depth?: boolean;
}) {
  const inner = deeper(level);
  const at = chapter ? chapter.lessonIds.indexOf(lesson.id) : -1;
  const id = `fast-${lesson.id}`;
  return (
    <article id={id} aria-labelledby={`${id}-title`} className="rule-t flex flex-col gap-3 pt-4">
      <div className="flex flex-col gap-1">
        <p className="t-label t-figure">
          <span className={priority === 'Must' ? 'text-fg' : undefined}>{priority}</span>
          {chapter ? ` · ${chapter.title}` : ''}
          {at >= 0 ? ` · lesson ${pad(at + 1)}` : ''}
        </p>
        <Heading level={level} id={`${id}-title`} className="t-section">
          {lesson.title}
        </Heading>
      </div>
      {lesson.summary ? (
        <RichHtml
          value={{ md: '', html: firstParagraph(lesson.summary.html) }}
          className="lecture-prose"
        />
      ) : (
        <p className="prose-measure">{lesson.opening}</p>
      )}
      <RememberBox items={lesson.remember} level={inner} />
      <TermsTable terms={lesson.terms} level={inner} />
      {depth
        ? lesson.deeper.map((part, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Heading level={inner} className="font-medium">
                <RichHtml value={part.title} inline />
              </Heading>
              <RichHtml value={part.body} className="lecture-prose" />
            </div>
          ))
        : null}
      {lesson.interview.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="t-label text-fg">Interview questions, strong answers</p>
          {lesson.interview.map((qa, i) => (
            <div key={i} className="lecture-answer flex flex-col gap-1">
              <Heading level={inner} className="font-medium">
                <span className="t-figure text-muted pr-1 text-sm">Q{i + 1}</span>
                <RichHtml value={qa.question} inline />
              </Heading>
              <RichHtml value={qa.answer} className="lecture-prose border-border border-l-2 pl-2" />
            </div>
          ))}
        </div>
      ) : null}
      {lesson.pitfalls.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="t-label text-fg">Top mistakes</p>
          <ul className="flex flex-col gap-2">
            {lesson.pitfalls.slice(0, 3).map((pitfall, i) => (
              <li key={i}>
                <RichHtml value={pitfall} className="lecture-prose" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="lecture-screen-only text-sm">
        <Link
          href={`/lectures/${lesson.moduleSlug}/${lesson.slug}`}
          className="text-muted hover:text-fg underline underline-offset-4 transition-colors duration-150 ease-out"
        >
          Full lecture, with every example and solution
        </Link>
      </p>
    </article>
  );
}

/** How to use the plan: the routine per lesson and the shape of a strong answer. */
export function FastTrackIntro({ lecture, level }: { lecture: FastTrackLecture; level: Level }) {
  const { plan } = lecture;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section aria-labelledby="fast-method" className="flex flex-col gap-2">
        <Heading level={level} id="fast-method" className="t-label text-fg">
          How to use it
        </Heading>
        <p className="text-muted text-sm">
          Most important first. Read <strong className="text-fg font-medium">Must</strong> in every
          block, <strong className="text-fg font-medium">Should</strong> if time allows. Short on
          time? Only the Must lessons.
        </p>
        <ol className="bg-raised border-border rounded-panel shadow-edge flex flex-col gap-1 border p-3">
          {plan.method.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="t-figure text-muted w-3 shrink-0 text-sm">{pad(i + 1)}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
      {plan.shapes.length > 0 ? (
        <section aria-labelledby="fast-shapes" className="flex flex-col gap-2">
          <Heading level={level} id="fast-shapes" className="t-label text-fg">
            Answer shapes that work in every round
          </Heading>
          <dl className="flex flex-col">
            {plan.shapes.map((shape) => (
              <div key={shape.label} className="rule-b flex flex-col gap-0.5 py-1">
                <dt className="font-medium">{shape.label}</dt>
                <dd className="text-muted text-sm">{shape.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

/** Every day of the plan in full. `pageBreaks` starts each day on a new page in print. */
export function FastTrackDays({
  lecture,
  level,
  pageBreaks = false,
}: {
  lecture: FastTrackLecture;
  /** Heading level of each day title; lessons sit one below. */
  level: Level;
  pageBreaks?: boolean;
}) {
  const lessonLevel = deeper(level);
  return (
    <div className="flex flex-col gap-12">
      {lecture.days.map((day, i) => (
        <section
          key={day.title}
          id={dayAnchor(i)}
          aria-labelledby={`${dayAnchor(i)}-title`}
          className={`flex flex-col gap-4 ${pageBreaks ? 'lecture-page-break' : ''}`}
        >
          <div className="flex flex-col gap-1">
            <p className="t-label t-figure">
              {day.must.length} must · {day.should.length} should
            </p>
            <Heading level={level} id={`${dayAnchor(i)}-title`} className="t-section text-xl">
              {day.title}
            </Heading>
            <p className="text-muted prose-measure text-lg">{day.why}</p>
          </div>
          {day.must.map((lesson) => (
            <FastLesson
              key={lesson.id}
              lesson={lesson}
              priority="Must"
              chapter={lecture.chapters.get(lesson.id)}
              level={lessonLevel}
              depth={day.depth}
            />
          ))}
          {day.should.map((lesson) => (
            <FastLesson
              key={lesson.id}
              lesson={lesson}
              priority="Should"
              chapter={lecture.chapters.get(lesson.id)}
              level={lessonLevel}
              depth={day.depth}
            />
          ))}
          {day.capstone ? (
            <CapstoneSummary
              partId={day.capstone.partId}
              title={day.capstone.title}
              brief={day.capstone.brief}
              solution={day.capstone.solution}
              level={lessonLevel}
            />
          ) : null}
        </section>
      ))}
      {lecture.guides.map((guide) => (
        <GuideView
          key={guide.id}
          guide={guide}
          level={level}
          className={pageBreaks ? 'lecture-page-break' : undefined}
        />
      ))}
    </div>
  );
}

export const guideAnchor = (id: string) => `guide-${id}`;

/** A standalone reading: its summary, then each section with its code. */
export function GuideView({
  guide,
  level,
  className,
}: {
  guide: CompiledGuide;
  level: Level;
  className?: string;
}) {
  const inner = deeper(level);
  const id = guideAnchor(guide.id);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`flex flex-col gap-4 ${className ?? ''}`}
    >
      <div className="flex flex-col gap-1">
        <p className="t-label t-figure">Guide · {guide.sections.length} sections</p>
        <Heading level={level} id={`${id}-title`} className="t-title">
          {guide.title}
        </Heading>
        <RichHtml value={guide.summary} className="lecture-prose text-muted" />
      </div>
      {guide.sections.map((section, i) => (
        <article key={i} className="rule-t flex flex-col gap-2 pt-4">
          <Heading level={inner} className="t-section">
            <RichHtml value={section.title} inline />
          </Heading>
          <RichHtml value={section.body} className="lecture-prose" />
        </article>
      ))}
    </section>
  );
}
