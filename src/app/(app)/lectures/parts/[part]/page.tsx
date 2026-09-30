import { AudioPlayer } from '@/features/lecture/AudioPlayer';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass } from '@/components/ui/Button';
import { Crumbs } from '@/features/lecture/Crumbs';
import { CapstoneView, ChapterRow } from '@/features/lecture/GroupViews';
import { readingTime } from '@/features/lecture/parts';
import { PdfButton } from '@/features/lecture/PdfButton';
import { Title } from '@/features/motion/Title';
import { getLectureIndex, getManifest, getPartLecture } from '@/lib/content';

type Props = { params: Promise<{ part: string }> };

const pad = (n: number) => String(n).padStart(2, '0');

export async function generateStaticParams() {
  const { parts } = await getLectureIndex();
  return parts.map((part) => ({ part: part.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { part: id } = await params;
  const part = (await getLectureIndex()).parts.find((p) => p.id === id);
  return part ? { title: `${part.title} · Lecture`, description: part.summary } : {};
}

/**
 * A part as a reading plan: its chapters in order, then the project with its worked
 * solution. The chapters are read on their own pages, one after the other; the PDF holds
 * the whole part in one file.
 */
export default async function PartLecturePage({ params }: Props) {
  const { part: id } = await params;
  const [lecture, { contentRev }] = await Promise.all([getPartLecture(id), getManifest()]);
  if (!lecture) notFound();
  const { part, chapters, solution } = lecture;
  const first = chapters[0]?.chapter;
  const title = `Part ${pad(part.number)}, ${part.title}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
        <div className="col-span-4 flex flex-col gap-2 md:col-span-8">
          <Crumbs trail={[{ href: '/lectures', label: 'Lectures' }]} />
          <p className="t-label t-figure">
            Part {pad(part.number)} · {chapters.length} chapters ·{' '}
            {readingTime(lecture.readingMinutes)}
          </p>
          <Title>{part.title}</Title>
          <p data-arrive="rise" className="text-muted prose-measure text-lg">
            {part.summary}
          </p>
        </div>
        <div className="col-span-4 flex flex-wrap items-end gap-1 md:col-span-4 md:justify-end">
          {first ? (
            <Link href={`/lectures/${first.slug}`} className={buttonClass('primary', 'md')}>
              Start reading
            </Link>
          ) : null}
          <PdfButton scope={{ kind: 'part', id: part.id }} title={title} rev={contentRev} />
        </div>
      </header>

      <AudioPlayer scope={{ kind: 'part', id: part.id }} label={part.title} />

      <section aria-labelledby="part-chapters" className="flex flex-col gap-2">
        <h2 id="part-chapters" className="t-label">
          Chapters
        </h2>
        <div className="rule-t">
          {chapters.map(({ chapter, readingMinutes }) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              minutes={readingMinutes}
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

      <div className="rule-t pt-4">
        <CapstoneView
          title={part.capstone.title}
          brief={part.capstone.brief}
          solution={solution}
          level={2}
        />
      </div>
    </div>
  );
}
