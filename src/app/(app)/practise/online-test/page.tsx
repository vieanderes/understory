import type { Metadata } from 'next';
import { OnlineTestHub } from '@/features/online-test/OnlineTestHub';
import { getAllLessonRoutes, getOnlineTestIndex } from '@/lib/content';

export const metadata: Metadata = {
  title: 'AI-assisted coding simulator',
  description: 'Timed, AI-assisted coding tests in a real assessment IDE, scored on hidden tests.',
};

/** The levelled mock runs in the lesson player, but it is listed with the practice tests. */
const LEVELLED_MOCK = 'interview.mock-levelled';

export default async function OnlineTestPage() {
  const [index, routes] = await Promise.all([getOnlineTestIndex(), getAllLessonRoutes()]);
  const levelled = routes.find((route) => route.lessonId === LEVELLED_MOCK);
  return (
    <OnlineTestHub
      index={index}
      {...(levelled
        ? { levelledHref: `/learn/${levelled.moduleSlug}/${levelled.lessonSlug}` }
        : {})}
    />
  );
}
