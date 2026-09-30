import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Zap } from 'lucide-react';
import { PageHead } from '@/components/layout/PageHead';
import { JourneyView, type JourneyPart } from '@/features/journey/JourneyView';
import { getCourse, getManifest } from '@/lib/content';
import { getJourneyParts } from '@/lib/content/outline';
import { Title } from '@/features/motion/Title';

export const metadata: Metadata = {
  title: 'Learn',
  description: 'The whole course in seven parts, from a first line of code to a system under load.',
};

const OTHER_WAYS = [
  {
    href: '/lectures',
    icon: BookOpen,
    title: 'Read as lectures',
    note: 'Every lesson as reading, with audio and a PDF',
  },
  {
    href: '/lectures#fast-tracks',
    icon: Zap,
    title: 'Fast tracks',
    note: 'Condensed plans for an interview or a refresher',
  },
] as const;

export default async function LearnPage() {
  const [course, manifest, journey] = await Promise.all([
    getCourse(),
    getManifest(),
    getJourneyParts(),
  ]);
  const concepts = new Map(manifest.parts.map((part) => [part.id, part.concepts]));
  const parts: JourneyPart[] = journey.map((part) => ({
    ...part,
    concepts: concepts.get(part.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHead
        label={<>Learn · {course.title}</>}
        title={
          <Title>
            Seven parts. <span className="text-muted">One milestone at a time.</span>
          </Title>
        }
        lede="Each part ends with a checkpoint, a small project and a milestone that says what you can now build. Nothing is locked."
        aside={<OtherWays />}
        asideClassName="hidden md:flex"
      />
      <JourneyView parts={parts} />
      <div className="md:hidden">
        <OtherWays />
      </div>
    </div>
  );
}

/** Lectures and fast tracks: the same course, read rather than practised. */
function OtherWays() {
  return (
    <nav aria-label="Other ways in" className="flex flex-col">
      <p className="t-label pb-1">Other ways in</p>
      <ul className="flex flex-col">
        {OTHER_WAYS.map(({ href, icon: Icon, title, note }) => (
          <li key={href} className="rule-t">
            <Link
              href={href}
              className="group hover:bg-surface flex min-h-6 items-center gap-2 py-1 transition-colors duration-150 ease-out"
            >
              <Icon aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{title}</span>
                <span className="text-muted block text-sm">{note}</span>
              </span>
              <ArrowRight
                aria-hidden
                size={16}
                strokeWidth={2}
                className="text-muted shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
