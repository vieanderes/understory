import type { Metadata } from 'next';
import { JsonLd } from '@/components/app/JsonLd';
import { courseTree } from '@/features/paths/custom';
import { HomeScreen, type CourseOutline, type NewsBrief } from '@/features/paths/HomeScreen';
import { getManifest, getPaths, getPlanCatalog } from '@/lib/content';
import { getLatestDay } from '@/lib/news';
import { siteData } from '@/lib/structured-data';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const [paths, manifest, catalog, day] = await Promise.all([
    getPaths(),
    getManifest(),
    getPlanCatalog(),
    getLatestDay(),
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
  // Only what Home shows travels to the client: the date and the headlines.
  const news: NewsBrief | null = day
    ? {
        date: day.date,
        items: day.items.map(({ id, title, topics }) => ({ id, title, topics })),
      }
    : null;
  return (
    <>
      <JsonLd data={siteData()} />
      <HomeScreen
        paths={paths}
        course={course}
        catalog={catalog}
        news={news}
        tree={courseTree(manifest)}
      />
    </>
  );
}
