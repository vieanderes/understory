import type { Metadata } from 'next';
import { PathBuilder } from '@/features/paths/PathBuilder';
import { courseTree } from '@/features/paths/custom';
import { getManifest } from '@/lib/content';

export const metadata: Metadata = { title: 'Build your own path', robots: { index: false } };

export default async function BuildPathPage() {
  return <PathBuilder tree={courseTree(await getManifest())} />;
}
