import { AudioPlayer } from '@/features/lecture/AudioPlayer';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Crumbs } from '@/features/lecture/Crumbs';
import { lectureOutline, LessonLectureView } from '@/features/lecture/LessonLectureView';
import { PdfButton } from '@/features/lecture/PdfButton';
import {
  findLectureChapter,
  getAllLessonRoutes,
  getLessonLecture,
  getManifest,
} from '@/lib/content';

type Props = { params: Promise<{ chapter: string; lesson: string }> };

const pad = (n: number) => String(n).padStart(2, '0');

export async function generateStaticParams() {
  const routes = await getAllLessonRoutes();
  return routes.map((route) => ({ chapter: route.moduleSlug, lesson: route.lessonSlug }));
}

async function lessonIdOf(params: Props['params']): Promise<string | undefined> {
  const { chapter, lesson } = await params;
  const routes = await getAllLessonRoutes();
  return routes.find((r) => r.moduleSlug === chapter && r.lessonSlug === lesson)?.lessonId;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await lessonIdOf(params);
  const lecture = id ? await getLessonLecture(id) : undefined;
  return lecture ? { title: `${lecture.title} · Lecture`, description: lecture.objective } : {};
}

/** One lesson as a lecture. The URL mirrors the lesson's own: /learn/… becomes /lectures/…. */
export default async function LessonLecturePage({ params }: Props) {
  const id = await lessonIdOf(params);
  const [lecture, { contentRev }] = await Promise.all([
    id ? getLessonLecture(id) : undefined,
    getManifest(),
  ]);
  if (!lecture) notFound();
  const chapter = await findLectureChapter(lecture.moduleId);
  const at = chapter?.lessonIds.indexOf(lecture.id) ?? -1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Crumbs
          trail={[
            { href: '/lectures', label: 'Lectures' },
            ...(chapter ? [{ href: `/lectures/${chapter.slug}`, label: chapter.title }] : []),
          ]}
        />
        <PdfButton
          scope={{ kind: 'lesson', id: lecture.id }}
          title={lecture.title}
          rev={contentRev}
        />
      </div>
      <div className="grid grid-cols-4 gap-x-4 md:grid-cols-12">
        <div className="col-span-4 min-w-0 md:col-span-10 lg:col-span-8">
          <div className="pb-6">
            <AudioPlayer scope={{ kind: 'lesson', id: lecture.id }} label={lecture.title} />
          </div>
          <LessonLectureView
            lecture={lecture}
            level={1}
            {...(at >= 0 ? { number: pad(at + 1) } : {})}
            {...(chapter ? { context: chapter.title } : {})}
          />
        </div>
        <nav
          aria-label="On this page"
          className="lecture-screen-only hidden lg:col-span-3 lg:col-start-10 lg:block"
        >
          <div className="sticky top-12 flex flex-col gap-1">
            <p className="t-label">On this page</p>
            <ol className="flex flex-col">
              {lectureOutline(lecture).map((entry) => (
                <li key={entry.href} className="rule-b">
                  <a
                    href={entry.href}
                    className="hover:text-accent flex min-h-5 items-center py-1 text-sm transition-colors duration-150 ease-out"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
      {chapter ? (
        <p className="rule-t pt-3 text-sm">
          <Link
            href={`/lectures/${chapter.slug}#lesson-${lecture.id}`}
            className="text-muted hover:text-fg underline underline-offset-4 transition-colors duration-150 ease-out"
          >
            Read the whole chapter, {chapter.title}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
