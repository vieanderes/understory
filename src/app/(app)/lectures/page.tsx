import { AudioPlayer } from '@/features/lecture/AudioPlayer';
import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { ChapterRow } from '@/features/lecture/GroupViews';
import { readingTime } from '@/features/lecture/parts';
import { PdfButton } from '@/features/lecture/PdfButton';
import { Title } from '@/features/motion/Title';
import { getLectureIndex, getLectureTimes, getManifest, getTrackSummaries } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Lectures',
  description:
    'Every lesson as reading: explanations, worked examples, full solutions and what to remember. Read in the app or download as PDF.',
};

const pad = (n: number) => String(n).padStart(2, '0');

export default async function LecturesPage() {
  const [index, times, { contentRev }, tracks] = await Promise.all([
    getLectureIndex(),
    getLectureTimes(),
    getManifest(),
    getTrackSummaries(),
  ]);
  const lessons = index.parts.reduce(
    (sum, part) => sum + part.chapters.reduce((n, chapter) => n + chapter.lessonIds.length, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
        <div className="col-span-4 flex flex-col gap-2 md:col-span-8">
          <p className="t-label">Lectures · {index.title}</p>
          <Title>
            Read it all. <span className="text-muted">Practise when you want to.</span>
          </Title>
          <p data-arrive="rise" className="text-muted prose-measure">
            Every lesson as a lecture: the explanations, worked examples with the reasons, every
            exercise with its full solution, and the sentences to remember. Read a lesson, a
            chapter, a part or the whole course, here or as a PDF.
          </p>
        </div>
        <div className="col-span-4 flex flex-col items-start gap-1 md:col-span-4 md:items-end md:justify-end">
          <PdfButton
            scope={{ kind: 'course' }}
            title={index.title}
            rev={contentRev}
            variant="primary"
            label="Download the whole course"
          />
          <p className="t-label t-figure">
            {lessons} lessons · {readingTime(times.get('course') ?? 0)}
          </p>
        </div>
      </header>

      <AudioPlayer scope={{ kind: 'course' }} label={index.title} />

      <section
        id="fast-tracks"
        aria-labelledby="lecture-fast-tracks"
        className="rule-t grid grid-cols-4 gap-x-4 gap-y-2 py-4 md:grid-cols-12"
      >
        <div className="col-span-4 flex flex-col gap-1 md:col-span-5">
          <h2 id="lecture-fast-tracks" className="t-section">
            Learning paths, as lectures
          </h2>
          <p className="text-muted prose-measure text-sm">
            Each learning path cut to what you need to read: the key idea, the answers to know and
            the mistakes to avoid, in order.
          </p>
        </div>
        <ul className="col-span-4 flex flex-col md:col-span-7">
          {tracks.map((track) => (
            <li
              key={track.id}
              // The whole row opens the lecture; the PDF button sits above that layer.
              className="hairline-row group rule-b relative flex items-center justify-between gap-2 py-1 sm:gap-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/lectures/tracks/${track.id}`}
                  className="focus-visible:outline-accent rounded-control font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {track.title}
                </Link>
                <p className="text-muted text-sm">{track.summary}</p>
              </div>
              <div className="relative z-10 shrink-0">
                <PdfButton
                  scope={{ kind: 'track', id: track.id }}
                  title={track.title}
                  rev={contentRev}
                  variant="quiet"
                  label="PDF"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ol className="flex flex-col" aria-label="Parts">
        {index.parts.map((part) => (
          <li key={part.id}>
            <section
              aria-labelledby={`lecture-part-${part.id}`}
              className="rule-t grid grid-cols-4 gap-x-4 gap-y-2 py-4 md:grid-cols-12"
            >
              <div className="col-span-4 flex flex-col gap-1 md:col-span-5">
                <p className="t-label t-figure">
                  Part {pad(part.number)} · {readingTime(times.get(`part-${part.id}`) ?? 0)}
                </p>
                <h2 id={`lecture-part-${part.id}`} className="t-section">
                  <Link
                    href={`/lectures/parts/${part.id}`}
                    className="hover:text-accent transition-colors duration-150 ease-out"
                  >
                    {part.title}
                  </Link>
                </h2>
                <p className="text-muted prose-measure text-sm">{part.summary}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Link href={`/lectures/parts/${part.id}`} className={buttonClass('quiet', 'md')}>
                    Open part
                  </Link>
                  <PdfButton
                    scope={{ kind: 'part', id: part.id }}
                    title={`Part ${pad(part.number)}, ${part.title}`}
                    rev={contentRev}
                    variant="quiet"
                    label="PDF"
                  />
                </div>
              </div>
              <div className="col-span-4 md:col-span-7">
                {part.chapters.map((chapter) => (
                  <ChapterRow
                    key={chapter.id}
                    chapter={chapter}
                    minutes={times.get(`chapter-${chapter.id}`)}
                    actions={
                      <PdfButton
                        scope={{ kind: 'chapter', id: chapter.id }}
                        title={chapter.title}
                        rev={contentRev}
                        variant="quiet"
                        label="PDF"
                      />
                    }
                  />
                ))}
              </div>
            </section>
          </li>
        ))}
      </ol>

      {index.woven.length > 0 ? (
        <section
          aria-labelledby="lecture-woven"
          className="rule-t grid grid-cols-4 gap-x-4 gap-y-2 py-4 md:grid-cols-12"
        >
          <div className="col-span-4 flex flex-col gap-1 md:col-span-5">
            <h2 id="lecture-woven" className="t-section">
              Woven chapters
            </h2>
            <p className="text-muted prose-measure text-sm">
              Their lessons appear inside the parts, where they are taught. Here they read as one
              chapter each.
            </p>
          </div>
          <div className="col-span-4 md:col-span-7">
            {index.woven.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                minutes={times.get(`chapter-${chapter.id}`)}
                actions={
                  <PdfButton
                    scope={{ kind: 'chapter', id: chapter.id }}
                    title={chapter.title}
                    rev={contentRev}
                    variant="quiet"
                    label="PDF"
                  />
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
