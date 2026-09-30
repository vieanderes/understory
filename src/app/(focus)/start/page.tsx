import type { Metadata } from 'next';
import { PlacementRunner, type EntryModule } from '@/features/placement/PlacementRunner';
import { getModules, getPlacement } from '@/lib/content';

export const metadata: Metadata = { title: 'Find your level', robots: { index: false } };

export default async function StartPage() {
  const [ladder, courseModules] = await Promise.all([getPlacement(), getModules()]);
  const modules: EntryModule[] = courseModules.map((courseModule) => {
    const first = courseModule.lessons[0];
    return {
      id: courseModule.id,
      title: courseModule.title,
      href: first ? `/learn/${courseModule.slug}/${first.slug}` : '/learn',
    };
  });
  return <PlacementRunner rungs={ladder.rungs} modules={modules} />;
}
