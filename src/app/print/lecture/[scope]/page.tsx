import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InlineScript } from '@/components/theme/InlineScript';
import { parseScopeKey, type LectureScope } from '@/core/lecture';
import { AutoPrint } from '@/features/lecture/AutoPrint';
import {
  dayAnchor,
  FastTrackDays,
  FastTrackIntro,
  guideAnchor,
} from '@/features/lecture/FastTrackView';
import { CapstoneView, ChapterBody } from '@/features/lecture/GroupViews';
import { LessonLectureView } from '@/features/lecture/LessonLectureView';
import { readingTime } from '@/features/lecture/parts';
import {
  getChapterLecture,
  getTrack,
  getLectureIndex,
  getLessonLecture,
  getManifest,
  getPartLecture,
  type LectureChapter,
  type PartLecture,
} from '@/lib/content';
import type { LessonLecture } from '@/core/lecture';

/*
 * The document a PDF is printed from (scripts/build-lectures.ts), and the page the
 * download button opens when no PDF was built. No app chrome: a cover, the contents, then
 * the reading, with a page break before every part, chapter and lesson. Always light,
 * because paper is.
 */

type Props = { params: Promise<{ scope: string }> };

export const metadata: Metadata = {
  title: 'Lecture',
  robots: { index: false, follow: false },
};

// Paper is light whatever the reader's theme, and the root script has already run.
const LIGHT = "document.documentElement.dataset.theme='light';";

const pad = (n: number) => String(n).padStart(2, '0');

function Cover({
  kicker,
  title,
  lines,
  rev,
}: {
  kicker: string;
  title: string;
  lines: string[];
  rev: string;
}) {
  return (
    <header className="lecture-cover flex flex-col gap-3">
      <p className="t-label">Understory · {kicker}</p>
      <h1 className="t-title">{title}</h1>
      {lines.map((line, i) => (
        <p key={i} className={i === 0 ? 'prose-measure text-lg' : 'text-muted prose-measure'}>
          {line}
        </p>
      ))}
      <p className="t-label t-figure pt-2">Content revision {rev}</p>
    </header>
  );
}

function Contents({ entries }: { entries: { href: string; label: string; depth: 0 | 1 }[] }) {
  return (
    <nav aria-label="Contents" className="lecture-contents lecture-page-break flex flex-col gap-2">
      <p className="t-label">Contents</p>
      <ol className="flex flex-col">
        {entries.map((entry) => (
          <li
            key={entry.href}
            className={entry.depth === 0 ? 'rule-b py-1 font-medium' : 'py-0.5 pl-4 text-sm'}
          >
            <a href={entry.href}>{entry.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ChapterOpening({ chapter }: { chapter: LectureChapter }) {
  return (
    <header id={`chapter-${chapter.id}`} className="flex flex-col gap-2">
      <p className="t-label t-figure">
        Chapter {pad(chapter.number)} · {chapter.lessonIds.length} lessons
      </p>
      <h2 className="t-title">{chapter.title}</h2>
      <p className="prose-measure text-lg">{chapter.why}</p>
      <p className="text-muted prose-measure">{chapter.summary}</p>
      <p className="text-muted prose-measure text-sm">
        <span className="t-label pr-1">You can build</span>
        {chapter.youCanBuild}
      </p>
    </header>
  );
}

/** A part's chapters (h2, lessons h3) and its project. The part title above is an h1. */
function PartSection({ lecture }: { lecture: PartLecture }) {
  const { part, chapters, solution } = lecture;
  return (
    <>
      {chapters.map(({ chapter, lessons }) => (
        <section key={chapter.id} className="lecture-page-break flex flex-col gap-8">
          <ChapterOpening chapter={chapter} />
          <ChapterBody chapter={chapter} lessons={lessons} level={3} pageBreaks />
        </section>
      ))}
      <section className="lecture-page-break">
        <CapstoneView
          title={part.capstone.title}
          brief={part.capstone.brief}
          solution={solution}
          level={2}
          display
        />
      </section>
    </>
  );
}

const lessonEntries = (lessons: readonly LessonLecture[]) =>
  lessons.map((lesson) => ({
    href: `#lesson-${lesson.id}`,
    label: lesson.title,
    depth: 1 as const,
  }));

async function Document({ scope, rev }: { scope: LectureScope; rev: string }) {
  switch (scope.kind) {
    case 'lesson': {
      const lecture = await getLessonLecture(scope.id);
      if (!lecture) notFound();
      const chapter = (await getChapterLecture(lecture.moduleId))?.chapter;
      const at = chapter?.lessonIds.indexOf(lecture.id) ?? -1;
      return (
        <LessonLectureView
          lecture={lecture}
          level={1}
          showLessonLink={false}
          {...(at >= 0 ? { number: pad(at + 1) } : {})}
          {...(chapter ? { context: chapter.title } : {})}
        />
      );
    }

    case 'chapter': {
      const lecture = await getChapterLecture(scope.id);
      if (!lecture) notFound();
      const { chapter, lessons } = lecture;
      return (
        <>
          <Cover
            kicker={
              chapter.part ? `Part ${pad(chapter.part.number)}, ${chapter.part.title}` : 'Chapter'
            }
            title={chapter.title}
            lines={[
              chapter.why,
              `${lessons.length} lessons · ${readingTime(lecture.readingMinutes)}`,
            ]}
            rev={rev}
          />
          <Contents
            entries={[
              ...lessonEntries(lessons).map((entry) => ({ ...entry, depth: 0 as const })),
              { href: `#recap-${chapter.id}`, label: 'Revision sheet', depth: 0 },
            ]}
          />
          <div className="lecture-page-break">
            <ChapterBody chapter={chapter} lessons={lessons} level={2} pageBreaks />
          </div>
        </>
      );
    }

    case 'part': {
      const lecture = await getPartLecture(scope.id);
      if (!lecture) notFound();
      const { part, chapters } = lecture;
      return (
        <>
          <Cover
            kicker={`Part ${pad(part.number)}`}
            title={part.title}
            lines={[
              part.summary,
              `${chapters.length} chapters · ${readingTime(lecture.readingMinutes)}`,
            ]}
            rev={rev}
          />
          <Contents
            entries={[
              ...chapters.flatMap(({ chapter, lessons }) => [
                { href: `#chapter-${chapter.id}`, label: chapter.title, depth: 0 as const },
                ...lessonEntries(lessons),
              ]),
              {
                href: `#capstone-${part.id}`,
                label: `Project: ${part.capstone.title}`,
                depth: 0,
              },
            ]}
          />
          <PartSection lecture={lecture} />
        </>
      );
    }

    case 'track': {
      const lecture = await getTrack(scope.id);
      if (!lecture) notFound();
      return (
        <>
          <Cover
            kicker="Fast track"
            title={lecture.plan.title}
            lines={[
              lecture.plan.summary,
              `${lecture.days.length} days · ${lecture.lessonCount} lessons · ${readingTime(lecture.readingMinutes)}`,
            ]}
            rev={rev}
          />
          <div className="lecture-page-break">
            <FastTrackIntro lecture={lecture} level={2} />
          </div>
          <Contents
            entries={lecture.days
              .flatMap((day, i) => [
                { href: `#${dayAnchor(i)}`, label: day.title, depth: 0 as const },
                ...[...day.must, ...day.should].map((lesson) => ({
                  href: `#fast-${lesson.id}`,
                  label: lesson.title,
                  depth: 1 as const,
                })),
              ])
              .concat(
                lecture.guides.map((guide) => ({
                  href: `#${guideAnchor(guide.id)}`,
                  label: guide.title,
                  depth: 0 as const,
                })),
              )}
          />
          <FastTrackDays lecture={lecture} level={1} pageBreaks />
        </>
      );
    }

    case 'course': {
      const index = await getLectureIndex();
      const parts = (await Promise.all(index.parts.map((part) => getPartLecture(part.id)))).filter(
        (part): part is PartLecture => part !== undefined,
      );
      const minutes = parts.reduce((sum, part) => sum + part.readingMinutes, 0);
      const lessons = parts.reduce(
        (sum, part) => sum + part.chapters.reduce((n, c) => n + c.lessons.length, 0),
        0,
      );
      return (
        <>
          <Cover
            kicker="The whole course"
            title={index.title}
            lines={[
              index.summary,
              `${parts.length} parts · ${lessons} lessons · ${readingTime(minutes)}`,
            ]}
            rev={rev}
          />
          <Contents
            entries={parts.flatMap(({ part, chapters }) => [
              {
                href: `#part-${part.id}`,
                label: `Part ${pad(part.number)}, ${part.title}`,
                depth: 0 as const,
              },
              ...chapters.map(({ chapter }) => ({
                href: `#chapter-${chapter.id}`,
                label: chapter.title,
                depth: 1 as const,
              })),
            ])}
          />
          {parts.map((lecture) => (
            <div key={lecture.part.id} className="flex flex-col gap-8">
              <header
                id={`part-${lecture.part.id}`}
                className="lecture-page-break flex flex-col gap-2"
              >
                <p className="t-label t-figure">
                  Part {pad(lecture.part.number)} · {readingTime(lecture.readingMinutes)}
                </p>
                <h1 className="t-title">{lecture.part.title}</h1>
                <p className="prose-measure text-lg">{lecture.part.summary}</p>
              </header>
              <PartSection lecture={lecture} />
            </div>
          ))}
        </>
      );
    }
  }
}

export default async function PrintLecturePage({ params }: Props) {
  const scope = parseScopeKey((await params).scope);
  if (!scope) notFound();
  const { contentRev } = await getManifest();
  return (
    <main id="content" className="lecture-print frame flex flex-col gap-12 py-6">
      <InlineScript html={LIGHT} />
      <AutoPrint />
      <Document scope={scope} rev={contentRev} />
    </main>
  );
}
