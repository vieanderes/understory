import type { Metadata } from 'next';
import type { MapModule, MapPart } from '@/features/map/MapView';
import { courseTree } from '@/features/paths/custom';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import {
  getManifest,
  getModules,
  getOnlineTestIndex,
  getPaths,
  getPlanCatalog,
} from '@/lib/content';

export const metadata: Metadata = {
  title: 'Progress',
  description: 'What you did, what holds, and what to work on next.',
};

export default async function ProgressPage() {
  const [paths, catalog, manifest, chapters, tests] = await Promise.all([
    getPaths(),
    getPlanCatalog(),
    getManifest(),
    getModules(),
    getOnlineTestIndex(),
  ]);
  const modules: MapModule[] = chapters.map((m) => ({
    id: m.id,
    number: m.number,
    title: m.title,
    concepts: m.concepts.map(({ id, title, summary }) => ({ id, title, summary })),
  }));
  const parts: MapPart[] = manifest.parts.map(({ id, title, summary, modules }) => ({
    id,
    title,
    summary,
    modules,
  }));
  const presets = [...tests.presets]
    .sort((a, b) => a.order - b.order)
    .map(({ id, title }) => ({ id, title }));

  return (
    <ProgressScreen
      paths={paths}
      planCatalog={catalog}
      tree={courseTree(manifest)}
      modules={modules}
      parts={parts}
      tests={presets}
    />
  );
}
