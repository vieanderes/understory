/**
 * The course as the path planner reads it (src/core/planner): every lesson with its minutes,
 * level and prerequisites, the parts, and Scout's compact text of it all, written paths
 * included. Built once at build time and served as a static file.
 */
import { plannerCatalog, type PlannerCourse, type PlannerLesson } from '@/core/planner';
import { getManifest } from './loaders';
import { getPaths } from './paths';

export interface PlannerCourseFile {
  /** Changes when the content does. */
  rev: string;
  /** Scout's text of the course, for the planner prompt. */
  catalog: string;
  course: PlannerCourse & {
    modules: (PlannerCourse['modules'][number] & {
      slug: string;
      lessons: (PlannerLesson & { href: string })[];
    })[];
  };
}

export async function getPlannerCourse(): Promise<PlannerCourseFile> {
  const [manifest, paths] = await Promise.all([getManifest(), getPaths()]);
  const course: PlannerCourseFile['course'] = {
    modules: manifest.modules.map((m) => ({
      id: m.id,
      number: m.number,
      slug: m.slug,
      title: m.title,
      summary: m.summary,
      youCanBuild: m.youCanBuild,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        objective: l.objective,
        level: l.level,
        minutes: l.minutes,
        prerequisites: l.prerequisites,
        href: `/learn/${m.slug}/${l.slug}`,
      })),
    })),
    parts: manifest.parts.map(({ id, title, summary, modules }) => ({ id, title, summary, modules })),
  };
  const written = paths.map((p) => ({
    id: p.id,
    name: p.name,
    promise: p.promise,
    stages: p.stages.map((s) => ({ title: s.title, lessonIds: s.lessons.map((l) => l.id) })),
  }));
  return { rev: manifest.contentRev, catalog: plannerCatalog(course, written), course };
}
