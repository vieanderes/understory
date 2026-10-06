import type { MetadataRoute } from 'next';
import { LABS } from '@/features/labs/registry';
import { getAllLessonRoutes, getLectureIndex, getPaths, getTrackIds } from '@/lib/content';
import { SITE_URL } from '@/lib/site';

/**
 * Every page a learner could land on from a search. Personal screens (progress, plan,
 * settings), timed tests and certificates are left out: they are empty or private without
 * the learner's own data.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [lessons, lectures, paths, tracks] = await Promise.all([
    getAllLessonRoutes(),
    getLectureIndex(),
    getPaths(),
    getTrackIds(),
  ]);
  const chapters = [...lectures.parts.flatMap((part) => part.chapters), ...lectures.woven];

  const entry = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    priority,
  });

  return [
    entry('/', 1),
    entry('/paths', 0.9),
    entry('/learn', 0.9),
    entry('/lectures', 0.8),
    entry('/practise', 0.8),
    entry('/practise/online-test', 0.8),
    entry('/labs', 0.7),
    entry('/library', 0.6),
    entry('/signal', 0.5),
    entry('/lectures/fast-track', 0.6),
    ...paths.map((p) => entry(`/paths/${p.id}`, 0.8)),
    ...tracks.map((id) => entry(`/lectures/tracks/${id}`, 0.6)),
    ...lectures.parts.map((part) => entry(`/lectures/parts/${part.id}`, 0.6)),
    ...chapters.map((chapter) => entry(`/lectures/${chapter.slug}`, 0.6)),
    ...LABS.map((lab) => entry(`/labs/${lab.id}`, 0.6)),
    ...lessons.map((r) => entry(`/learn/${r.moduleSlug}/${r.lessonSlug}`, 0.7)),
    ...lessons.map((r) => entry(`/lectures/${r.moduleSlug}/${r.lessonSlug}`, 0.5)),
  ];
}
