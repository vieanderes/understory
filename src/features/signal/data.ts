import { getAllLessonRoutes, getLesson } from '@/lib/content';
import type { NewsItem } from '@/lib/news';
import { getTopicLabels } from '@/lib/news/topics';
import type { LessonLink } from './StoryList';

/**
 * Everything a story list needs besides the stories, as plain objects for a client
 * component. Only the lessons the stories name are sent.
 */
export async function getStoryContext(items: readonly NewsItem[]): Promise<{
  topicLabels: Record<string, string>;
  lessons: Record<string, LessonLink>;
}> {
  const wanted = new Set(items.flatMap((item) => item.brief?.relatedLessons ?? []));
  const [labels, routes] = await Promise.all([getTopicLabels(), getAllLessonRoutes()]);
  const lessons: Record<string, LessonLink> = {};
  for (const route of routes) {
    if (!wanted.has(route.lessonId)) continue;
    const lesson = await getLesson(route.lessonId);
    if (!lesson) continue;
    lessons[route.lessonId] = {
      id: route.lessonId,
      title: lesson.title,
      href: `/learn/${route.moduleSlug}/${route.lessonSlug}`,
    };
  }
  return { topicLabels: Object.fromEntries(labels), lessons };
}
