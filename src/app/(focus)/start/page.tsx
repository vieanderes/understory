import type { Metadata } from 'next';
import { PlacementRunner } from '@/features/placement/PlacementRunner';
import type { PlacementData } from '@/features/placement/types';
import { getModules, getPaths, getPlacement } from '@/lib/content';

export const metadata: Metadata = { title: 'Find your level', robots: { index: false } };

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  const [placement, courseModules, paths, params] = await Promise.all([
    getPlacement(),
    getModules(),
    getPaths(),
    searchParams,
  ]);
  const data: PlacementData = {
    areas: placement.areas,
    rules: placement.paths,
    paths: paths.map((path) => ({
      id: path.id,
      name: path.name,
      stages: path.stages.map((s) => ({
        title: s.title,
        why: s.why,
        lessonIds: s.lessons.map((l) => l.id),
      })),
    })),
    lessons: courseModules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        href: `/learn/${m.slug}/${l.slug}`,
        moduleId: m.id,
        concepts: l.concepts,
      })),
    ),
    moduleTitles: Object.fromEntries(courseModules.map((m) => [m.id, m.title])),
  };
  const area = typeof params.area === 'string' ? params.area : undefined;
  const known = area && placement.areas.some((a) => a.id === area) ? area : undefined;
  // A new key starts a fresh check when "Check in depth" links from the results.
  return <PlacementRunner key={known ?? 'all'} data={data} {...(known ? { area: known } : {})} />;
}
