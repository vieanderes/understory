import type { Metadata } from 'next';
import { PracticeHome, type PracticePart } from '@/features/practice/PracticeHome';
import { getManifest } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Practice',
  description: 'Choose what to practise today: due items first, then first looks at new lessons.',
};

export default async function PractisePage() {
  const manifest = await getManifest();
  const parts: PracticePart[] = manifest.parts.map(({ id, title }, i) => ({
    id,
    number: i + 1,
    title,
  }));
  return <PracticeHome parts={parts} />;
}
