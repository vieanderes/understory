import type { Metadata } from 'next';
import { LearnScreen } from '@/features/paths/LearnScreen';
import { courseTree } from '@/features/paths/custom';
import { getManifest, getPaths, getPlanCatalog } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Learn',
  description: 'Your learning path: the lessons for one goal, tests along the way and an exam.',
};

export default async function LearnPage() {
  const [paths, catalog, manifest] = await Promise.all([
    getPaths(),
    getPlanCatalog(),
    getManifest(),
  ]);
  return <LearnScreen paths={paths} catalog={catalog} tree={courseTree(manifest)} />;
}
