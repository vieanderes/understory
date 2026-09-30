import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlayerForLesson } from '@/features/lesson-player/PlayerForLesson';
import { onPath } from '@/features/paths/links';
import { getAllLessonRoutes, getLessonByRoute, getModule, getPaths } from '@/lib/content';

type Props = { params: Promise<{ module: string; lesson: string }> };

export async function generateStaticParams() {
  const routes = await getAllLessonRoutes();
  return routes.map((r) => ({ module: r.moduleSlug, lesson: r.lessonSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const lesson = await getLessonByRoute(moduleSlug, lessonSlug);
  return lesson ? { title: lesson.title, description: lesson.objective } : {};
}

export default async function LessonPage({ params }: Props) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const lesson = await getLessonByRoute(moduleSlug, lessonSlug);
  if (!lesson) notFound();

  const courseModule = await getModule(moduleSlug);
  const solutionsFile = courseModule?.lessons.find((l) => l.id === lesson.id)?.solutionsFile;
  const routes = await getAllLessonRoutes();
  const position = routes.findIndex((r) => r.lessonId === lesson.id);
  const nextRoute = position >= 0 ? routes[position + 1] : undefined;
  const nextLesson = nextRoute
    ? await getLessonByRoute(nextRoute.moduleSlug, nextRoute.lessonSlug)
    : undefined;

  const onPaths = (await getPaths())
    .filter((path) => path.lessonIds.includes(lesson.id))
    .map((path) => {
      const lessons = path.stages.flatMap((stage) => stage.lessons);
      const after = lessons[lessons.findIndex((l) => l.id === lesson.id) + 1];
      return {
        id: path.id,
        name: path.name,
        next: after?.href ? { href: onPath(after.href, path.id), title: after.title } : null,
      };
    });

  return (
    <PlayerForLesson
      paths={onPaths}
      lesson={lesson}
      moduleTitle={courseModule?.title ?? ''}
      exitHref="/learn"
      solutionsUrl={solutionsFile ? `/content/v1/${solutionsFile}` : undefined}
      next={
        nextRoute && nextLesson
          ? {
              href: `/learn/${nextRoute.moduleSlug}/${nextRoute.lessonSlug}`,
              title: nextLesson.title,
            }
          : null
      }
    />
  );
}
