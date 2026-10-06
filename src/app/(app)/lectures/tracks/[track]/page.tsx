import { AudioPlayer } from '@/features/lecture/AudioPlayer';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Crumbs } from '@/features/lecture/Crumbs';
import {
  dayAnchor,
  FastTrackDays,
  FastTrackIntro,
  guideAnchor,
} from '@/features/lecture/FastTrackView';
import { readingTime } from '@/features/lecture/parts';
import { PdfButton } from '@/features/lecture/PdfButton';
import { Title } from '@/features/motion/Title';
import { getManifest, getTrack, getTrackIds } from '@/lib/content';

type Props = { params: Promise<{ track: string }> };

export async function generateStaticParams() {
  return (await getTrackIds()).map((track) => ({ track }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lecture = await getTrack((await params).track);
  return lecture ? { title: lecture.plan.title, description: lecture.plan.summary } : {};
}

/** A plan across the course for one goal, read top to bottom or downloaded as one PDF. */
export default async function TrackPage({ params }: Props) {
  const [lecture, { contentRev }] = await Promise.all([
    getTrack((await params).track),
    getManifest(),
  ]);
  if (!lecture) notFound();
  const { plan, days } = lecture;

  return (
    <div className="flex flex-col gap-8">
      <header className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
        <div className="col-span-4 flex flex-col gap-2 md:col-span-8">
          <Crumbs
            trail={[
              { href: '/paths', label: 'Learning paths' },
              { href: `/paths/${lecture.id}`, label: plan.name ?? plan.title },
            ]}
          />
          <p className="t-label t-figure">
            Path · {days.length} stages · {lecture.lessonCount} lessons ·{' '}
            {readingTime(lecture.readingMinutes)}
          </p>
          <Title>{plan.title}</Title>
          <p data-arrive="rise" className="text-muted prose-measure text-lg">
            {plan.summary}
          </p>
        </div>
        <div className="col-span-4 flex items-end md:col-span-4 md:justify-end">
          <PdfButton
            scope={{ kind: 'track', id: lecture.id }}
            title={plan.title}
            rev={contentRev}
            variant="primary"
          />
        </div>
      </header>

      <AudioPlayer scope={{ kind: 'track', id: lecture.id }} label={plan.title} />

      <FastTrackIntro lecture={lecture} level={2} />

      <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12">
        <nav aria-label="Days" className="lecture-screen-only col-span-4 md:col-span-3">
          <div className="contents-rail flex flex-col gap-1 md:sticky md:top-12">
            <p className="t-label">Stages</p>
            <ol className="flex flex-col">
              {days.map((day, i) => (
                <li key={day.title} className="rule-b">
                  <a
                    href={`#${dayAnchor(i)}`}
                    className="hover:text-accent flex min-h-5 flex-col py-1 text-sm transition-colors duration-150 ease-out"
                  >
                    <span>{day.title}</span>
                    <span className="t-label t-figure">
                      {day.must.length} must · {day.should.length} should
                    </span>
                  </a>
                </li>
              ))}
              {lecture.guides.map((guide) => (
                <li key={guide.id} className="rule-b">
                  <a
                    href={`#${guideAnchor(guide.id)}`}
                    className="hover:text-accent flex min-h-5 flex-col py-1 text-sm transition-colors duration-150 ease-out"
                  >
                    <span>{guide.title}</span>
                    <span className="t-label t-figure">
                      Guide · {guide.sections.length} sections
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
        <div className="col-span-4 min-w-0 md:col-span-9 lg:col-span-8">
          <FastTrackDays lecture={lecture} level={2} />
        </div>
      </div>
    </div>
  );
}
