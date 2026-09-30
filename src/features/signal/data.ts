import { getAllLessonRoutes, getLesson } from '@/lib/content';
import { getTopicLabels } from '@/lib/news/topics';
import type { LessonLink } from './SignalItem';

/** Everything a Signal page needs besides the news itself. */
export async function getSignalContext(): Promise<{
  topicLabels: Map<string, string>;
  lessons: Map<string, LessonLink>;
}> {
  const [topicLabels, routes] = await Promise.all([getTopicLabels(), getAllLessonRoutes()]);
  const lessons = new Map<string, LessonLink>();
  for (const route of routes) {
    const lesson = await getLesson(route.lessonId);
    if (!lesson) continue;
    lessons.set(route.lessonId, {
      id: route.lessonId,
      title: lesson.title,
      href: `/learn/${route.moduleSlug}/${route.lessonSlug}`,
    });
  }
  return { topicLabels, lessons };
}
