import type { Metadata } from 'next';
import { MOCKS_IN_SIMULATOR } from '@/core/online-test';
import { OnlineTestHub, type LessonTest } from '@/features/online-test/OnlineTestHub';
import { getManifest, getOnlineTestIndex } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Coding tests',
  description: 'Timed coding tests in a real assessment IDE, scored on hidden tests.',
};

/** Course mocks the simulator cannot run yet, numbered after its own practice tests. */
const LESSON_TEST_COPY: Record<string, { title: string; note: string }> = {
  'interview.mock-levelled': {
    title: 'Full mock 4: one task in four levels',
    note: 'Grow a small bank system over four levels in TypeScript, keeping every earlier level passing.',
  },
};

export default async function OnlineTestPage() {
  const [index, manifest] = await Promise.all([getOnlineTestIndex(), getManifest()]);
  const lessonTests: LessonTest[] = manifest.modules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.assessment === true && !(lesson.id in MOCKS_IN_SIMULATOR))
      .map((lesson) => ({
        id: lesson.id,
        title: LESSON_TEST_COPY[lesson.id]?.title ?? lesson.title,
        note: LESSON_TEST_COPY[lesson.id]?.note ?? 'In the lesson',
        href: `/learn/${module.slug}/${lesson.slug}`,
        minutes: lesson.minutes,
      })),
  );
  return <OnlineTestHub index={index} lessonTests={lessonTests} />;
}
