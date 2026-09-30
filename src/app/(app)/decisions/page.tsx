import type { Metadata } from 'next';
import { AdrLogView } from '@/features/adr/AdrLogView';
import { getManifest } from '@/lib/content';

export const metadata: Metadata = {
  title: 'ADR log',
  description: 'One architecture decision record per capstone, to keep as Markdown.',
  robots: { index: false },
};

export default async function DecisionsPage() {
  const parts = (await getManifest()).parts.map(({ id, title, capstone }) => ({
    id,
    title,
    capstone: { title: capstone.title },
  }));
  return <AdrLogView parts={parts} />;
}
