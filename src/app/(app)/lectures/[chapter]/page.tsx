import { AudioPlayer } from '@/features/lecture/AudioPlayer';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Crumbs } from '@/features/lecture/Crumbs';
import { ChapterBody } from '@/features/lecture/GroupViews';
import { readingTime } from '@/features/lecture/parts';
import { PdfButton } from '@/features/lecture/PdfButton';
import { Title } from '@/features/motion/Title';
import { findLectureChapter, getChapterLecture, getLectureIndex, getManifest } from '@/lib/content';

type Props = { params: Promise<{ chapter: string }> };

const pad = (n: number) => String(n).padStart(2, '0');

export async function generateStaticParams() {
  const index = await getLectureIndex();
  return [...index.parts.flatMap((part) => part.chapters), ...index.woven].map((chapter) => ({
    chapter: chapter.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const chapter = await findLectureChapter((await params).chapter);
  return chapter ? { title: `${chapter.title} · Lecture`, description: chapter.why } : {};
}

/** A whole chapter to read top to bottom, with its lessons listed beside it on a desk. */
export default async function ChapterLecturePage({ params }: Props) {
  const [lecture, { contentRev }] = await Promise.all([
    getChapterLecture((await params).chapter),
    getManifest(),
  ]);
  if (!lecture) notFound();
  const { chapter, lessons, previous, next } = lecture;

  return (
    <div className="flex flex-col gap-8">
      <header className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
        <div className="col-span-4 flex flex-col gap-2 md:col-span-8">
          <Crumbs
            trail={[
              { href: '/lectures', label: 'Lectures' },
              ...(chapter.part
                ? [
                    {
                      href: `/lectures/parts/${chapter.part.id}`,
                      label: `Part ${pad(chapter.part.number)}`,
                    },
                  ]
                : []),
            ]}
          />
          <p className="t-label t-figure">
            Chapter {pad(chapter.number)} · {lessons.length} lessons ·{' '}
            {readingTime(lecture.readingMinutes)}
          </p>
          <Title>{chapter.title}</Title>
          <p data-arrive="rise" className="prose-measure text-lg">
            {chapter.why}
          </p>
          <p className="text-muted prose-measure">{chapter.summary}</p>
        </div>
        <div className="col-span-4 flex items-end md:col-span-4 md:justify-end">
          <PdfButton
            scope={{ kind: 'chapter', id: chapter.id }}
            title={chapter.title}
            rev={contentRev}
            variant="primary"
            label="Download chapter PDF"
          />
        </div>
      </header>

      <AudioPlayer scope={{ kind: 'chapter', id: chapter.id }} label={chapter.title} />

      <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12">
        <nav
          aria-label="Lessons in this chapter"
          className="lecture-screen-only col-span-4 md:col-span-3"
        >
          <div className="flex flex-col gap-1 md:sticky md:top-12">
            <p className="t-label">In this chapter</p>
            <ol className="flex flex-col">
              {lessons.map((lesson, i) => (
                <li key={lesson.id} className="rule-b">
                  <a
                    href={`#lesson-${lesson.id}`}
                    className="hover:text-accent flex min-h-5 items-baseline gap-1 py-1 text-sm transition-colors duration-150 ease-out"
                  >
                    <span className="t-figure text-faint w-3 shrink-0">{pad(i + 1)}</span>
                    <span className="min-w-0">{lesson.title}</span>
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={`#recap-${chapter.id}`}
                  className="hover:text-accent flex min-h-5 items-baseline gap-1 py-1 text-sm transition-colors duration-150 ease-out"
                >
                  <span className="w-3 shrink-0" />
                  <span>Revision sheet</span>
                </a>
              </li>
            </ol>
          </div>
        </nav>

        <div className="col-span-4 min-w-0 md:col-span-9 lg:col-span-8">
          <ChapterBody chapter={chapter} lessons={lessons} level={2} />
        </div>
      </div>

      <nav
        aria-label="Other chapters"
        className="rule-t grid grid-cols-1 gap-2 pt-3 sm:grid-cols-2"
      >
        {previous ? (
          <Link
            href={`/lectures/${previous.slug}`}
            className="hover:bg-raised rounded-control flex flex-col gap-0.5 p-1 transition-colors duration-150 ease-out"
          >
            <span className="t-label">Previous chapter</span>
            <span className="font-medium">{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/lectures/${next.slug}`}
            className="hover:bg-raised rounded-control flex flex-col gap-0.5 p-1 text-right transition-colors duration-150 ease-out sm:items-end"
          >
            <span className="t-label">Next chapter</span>
            <span className="font-medium">{next.title}</span>
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
