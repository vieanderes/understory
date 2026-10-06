import Link from 'next/link';
import type { LessonLecture } from '@/core/lecture';

/** The sections a lesson lecture has, in order, for an outline beside it. */
export function lectureOutline(lecture: LessonLecture): { href: string; label: string }[] {
  const anchor = (part: string) => `#${lecture.id}-${part}`;
  return [
    { href: anchor('picture'), label: 'The big picture' },
    ...(lecture.remember.length > 0 ? [{ href: anchor('remember'), label: 'Remember' }] : []),
    { href: anchor('lesson'), label: 'The lesson, step by step' },
    ...(lecture.deeper.length > 0 || lecture.deepDive
      ? [{ href: anchor('deeper'), label: 'Going deeper' }]
      : []),
    ...(lecture.terms.length > 0 ? [{ href: anchor('terms'), label: 'Terms' }] : []),
    ...(lecture.pitfalls.length > 0
      ? [{ href: anchor('pitfalls'), label: 'Common mistakes' }]
      : []),
    ...(lecture.verify.length > 0 ? [{ href: anchor('ship'), label: 'Before you ship' }] : []),
    ...(lecture.interview.length > 0
      ? [{ href: anchor('interview'), label: 'Interview questions' }]
      : []),
    ...(lecture.flashcards.length > 0 ? [{ href: anchor('test'), label: 'Test yourself' }] : []),
  ];
}
import { BlockView } from './BlockView';
import {
  deeper,
  Heading,
  readingTime,
  RememberBox,
  RichHtml,
  TermsTable,
  type Level,
} from './parts';

/**
 * One lesson as a lecture, in the order of docs/LECTURE-BRIEF.md: the big picture, what to
 * remember, the lesson itself, depth, mistakes, the checks before shipping, interview
 * answers, a self-test and sources.
 * `level` is the heading level of the lesson title, so the same view works alone (1) and
 * inside a chapter or part (2 or 3).
 */
export function LessonLectureView({
  lecture,
  level,
  number,
  context,
  showLessonLink = true,
}: {
  lecture: LessonLecture;
  level: Level;
  /** The lesson's place in its chapter, as "03". */
  number?: string;
  /** A line above the title, for example the chapter it is in. */
  context?: string;
  showLessonLink?: boolean;
}) {
  const section = deeper(level);
  const item = deeper(section);
  const anchor = (part: string) => `${lecture.id}-${part}`;

  return (
    <article
      id={`lesson-${lecture.id}`}
      aria-labelledby={anchor('title')}
      className="lecture-lesson flex min-w-0 flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <p className="t-label t-figure">
          {[context, number ? `Lesson ${number}` : undefined, readingTime(lecture.readingMinutes)]
            .filter(Boolean)
            .join(' · ')}
          {lecture.assessment ? ' · Timed assessment' : ''}
        </p>
        <Heading
          level={level}
          id={anchor('title')}
          className={level === 1 ? 't-title' : 't-section'}
        >
          {lecture.title}
        </Heading>
        <p className="text-muted prose-measure text-lg">{lecture.objective}</p>
        {showLessonLink ? (
          <p className="lecture-screen-only pt-1 text-sm">
            <Link
              href={`/learn/${lecture.moduleSlug}/${lecture.slug}`}
              className="text-muted hover:text-fg underline underline-offset-4 transition-colors duration-150 ease-out"
            >
              Practise this lesson · {lecture.lessonMinutes} min
            </Link>
          </p>
        ) : null}
      </header>

      <section aria-labelledby={anchor('picture')} className="flex flex-col gap-2">
        <Heading level={section} id={anchor('picture')} className="t-label">
          The big picture
        </Heading>
        {lecture.summary ? (
          <RichHtml value={lecture.summary} className="lecture-prose" />
        ) : (
          <p className="prose-measure text-lg">{lecture.opening}</p>
        )}
      </section>

      <RememberBox items={lecture.remember} level={section} id={anchor('remember')} />

      <section aria-labelledby={anchor('lesson')} className="flex flex-col gap-4">
        <Heading level={section} id={anchor('lesson')} className="t-section rule-t pt-3">
          The lesson, step by step
        </Heading>
        <div className="lecture-blocks flex flex-col gap-6">
          {lecture.blocks.map((block) => (
            <BlockView key={block.id} block={block} level={item} />
          ))}
        </div>
      </section>

      {lecture.deeper.length > 0 || lecture.deepDive ? (
        <section aria-labelledby={anchor('deeper')} className="flex flex-col gap-4">
          <Heading level={section} id={anchor('deeper')} className="t-section rule-t pt-3">
            Going deeper
          </Heading>
          {lecture.deeper.map((part, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Heading level={item} className="font-medium">
                <RichHtml value={part.title} inline />
              </Heading>
              <RichHtml value={part.body} className="lecture-prose" />
            </div>
          ))}
          {lecture.deepDive ? (
            <div className="flex flex-col gap-2">
              <Heading level={item} className="font-medium">
                Deep dive
              </Heading>
              <RichHtml value={lecture.deepDive} className="lecture-prose" />
            </div>
          ) : null}
        </section>
      ) : null}

      {lecture.terms.length > 0 ? (
        <div className="rule-t pt-3">
          <TermsTable terms={lecture.terms} level={section} id={anchor('terms')} />
        </div>
      ) : null}

      {lecture.pitfalls.length > 0 ? (
        <section aria-labelledby={anchor('pitfalls')} className="flex flex-col gap-3">
          <Heading level={section} id={anchor('pitfalls')} className="t-section rule-t pt-3">
            Common mistakes
          </Heading>
          <ul className="flex flex-col gap-3">
            {lecture.pitfalls.map((pitfall, i) => (
              <li key={i} className="rule-b pb-3 last:border-b-0">
                <RichHtml value={pitfall} className="lecture-prose" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lecture.verify.length > 0 ? (
        <section aria-labelledby={anchor('ship')} className="flex flex-col gap-3">
          <Heading level={section} id={anchor('ship')} className="t-section rule-t pt-3">
            Before you ship
          </Heading>
          <dl className="flex flex-col">
            {lecture.verify.map((group) => (
              <div
                key={group.lens}
                className="rule-b grid grid-cols-4 gap-x-4 gap-y-1 py-2 last:border-b-0 md:grid-cols-12"
              >
                <dt className="t-label text-fg col-span-4 md:col-span-3">{group.label}</dt>
                <dd className="col-span-4 md:col-span-9">
                  <ul className="flex flex-col gap-1">
                    {group.checks.map((check, i) => (
                      <li key={i}>
                        <RichHtml value={check} inline />
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {lecture.interview.length > 0 ? (
        <section aria-labelledby={anchor('interview')} className="flex flex-col gap-4">
          <Heading level={section} id={anchor('interview')} className="t-section rule-t pt-3">
            Interview questions
          </Heading>
          {lecture.interview.map((qa, i) => (
            <div key={i} className="lecture-block flex flex-col gap-2">
              <Heading level={item} className="font-medium">
                <span className="t-figure text-muted pr-1 text-sm">Q{i + 1}</span>
                <RichHtml value={qa.question} inline />
              </Heading>
              <div className="lecture-answer flex flex-col gap-1">
                <p className="t-label text-fg">Strong answer</p>
                <RichHtml value={qa.answer} className="lecture-prose" />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {lecture.flashcards.length > 0 ? (
        <section aria-labelledby={anchor('test')} className="flex flex-col gap-3">
          <Heading level={section} id={anchor('test')} className="t-section rule-t pt-3">
            Test yourself
          </Heading>
          <p className="text-muted text-sm">Cover the answer, say yours out loud, then check.</p>
          <dl className="flex flex-col">
            {lecture.flashcards.map((card) => (
              <div
                key={card.id}
                className="rule-b grid grid-cols-4 gap-x-4 gap-y-1 py-2 md:grid-cols-12"
              >
                <dt className="col-span-4 font-medium md:col-span-5">
                  <RichHtml value={card.front} />
                </dt>
                <dd className="text-muted col-span-4 md:col-span-7">
                  <RichHtml value={card.back} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {lecture.references.length > 0 ? (
        <section aria-labelledby={anchor('sources')} className="flex flex-col gap-2">
          <Heading level={section} id={anchor('sources')} className="t-label">
            Sources
          </Heading>
          <ul className="flex flex-col gap-1 text-sm">
            {lecture.references.map((reference, i) => {
              const meta = [reference.authors, reference.venue, reference.year]
                .filter((part) => part !== undefined)
                .join(', ');
              return (
                <li key={i} className="flex min-w-0 flex-col">
                  {reference.url ? (
                    <a
                      href={reference.url}
                      className="lecture-link underline underline-offset-4"
                      rel="noreferrer"
                    >
                      {reference.title}
                    </a>
                  ) : (
                    <span>{reference.title}</span>
                  )}
                  {meta || reference.note ? (
                    <span className="text-muted">
                      {[meta, reference.note].filter(Boolean).join('. ')}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
