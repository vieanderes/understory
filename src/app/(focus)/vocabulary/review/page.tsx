import type { Metadata } from 'next';
import { WordReview } from '@/features/vocabulary/WordReview';

export const metadata: Metadata = { title: 'Review words', robots: { index: false } };

export default async function VocabularyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; round?: string | string[] }>;
}) {
  const { mode, round } = await searchParams;
  const kind = mode === 'speed' ? 'speed' : 'review';
  // "Play again" links to a new round number, which remounts the screen with a fresh queue.
  return <WordReview key={`${kind}-${String(round)}`} mode={kind} />;
}
