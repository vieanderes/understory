import { HomeScreen, type CourseOutline } from '@/features/paths/HomeScreen';
import { getManifest, getPaths, getPlanCatalog } from '@/lib/content';

export default async function HomePage() {
  const [paths, manifest, catalog] = await Promise.all([
    getPaths(),
    getManifest(),
    getPlanCatalog(),
  ]);
  const partOf = new Map(
    manifest.parts.flatMap((part) =>
      part.modules.map((moduleId) => [moduleId, part.title] as const),
    ),
  );
  const course: CourseOutline = {
    lessons: manifest.modules.reduce((sum, m) => sum + m.lessons.length, 0),
    parts: manifest.parts.length,
    order: manifest.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        href: `/learn/${module.slug}/${lesson.slug}`,
        minutes: lesson.minutes,
        part: `${partOf.get(module.id) ?? module.title} · ${module.title}`,
      })),
    ),
  };
  return <HomeScreen paths={paths} course={course} catalog={catalog} />;
}
