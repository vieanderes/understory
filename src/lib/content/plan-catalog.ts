/**
 * The catalogue a plan is built from (src/core/plan): the paths with their stages, the
 * course parts, and the simulator's preset tests, each lesson with its link.
 */
import type { PlanCatalog } from '@/core/plan';
import { getManifest } from './loaders';
import { getOnlineTestIndex } from './online-tests';
import { getPaths } from './paths';

export async function getPlanCatalog(): Promise<PlanCatalog> {
  const [paths, manifest, index] = await Promise.all([getPaths(), getManifest(), getOnlineTestIndex()]);
  const byModule = new Map(manifest.modules.map((m) => [m.id, m]));
  return {
    paths: paths.map((path) => ({
      id: path.id,
      name: path.name,
      stages: path.stages.map((stage) => ({
        title: stage.title,
        lessons: stage.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          minutes: l.minutes,
          ...(l.href ? { href: l.href } : {}),
        })),
      })),
    })),
    parts: manifest.parts.map((part) => ({
      id: part.id,
      title: part.title,
      lessons: part.modules.flatMap((moduleId) => {
        const found = byModule.get(moduleId);
        return found
          ? found.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              minutes: l.minutes,
              href: `/learn/${found.slug}/${l.slug}`,
            }))
          : [];
      }),
    })),
    tests: index.presets.map((preset) => ({ key: preset.id, title: preset.title, minutes: preset.minutes })),
  };
}
