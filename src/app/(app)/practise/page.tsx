import type { Metadata } from 'next';
import { PractisePanel } from '@/features/practice/PractisePanel';
import {
  PractiseOverview,
  type PractiseAssessment,
  type PractisePart,
} from '@/features/practice/PractiseOverview';
import { MOCKS_IN_SIMULATOR } from '@/core/online-test';
import { getManifest } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Practise',
  description: 'Spaced, interleaved practice sized in advance.',
};

export default async function PractisePage() {
  const manifest = await getManifest();
  const parts: PractisePart[] = manifest.parts.map(({ id, title, concepts }, i) => ({
    id,
    number: i + 1,
    title,
    concepts,
  }));
  const assessments: PractiseAssessment[] = manifest.modules.flatMap((module) =>
    module.lessons
      // Mocks the simulator runs are listed there, with the simulator's own tests.
      .filter((lesson) => lesson.assessment === true && !(lesson.id in MOCKS_IN_SIMULATOR))
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        href: `/learn/${module.slug}/${lesson.slug}`,
        minutes: lesson.minutes,
      })),
  );

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PractisePanel />
      <PractiseOverview parts={parts} assessments={assessments} />
    </div>
  );
}
