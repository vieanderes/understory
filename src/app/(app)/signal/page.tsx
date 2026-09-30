import type { Metadata } from 'next';
import { SignalDayView } from '@/features/signal/SignalDayView';
import { getLatestDay, listDates } from '@/lib/news';
import { Title } from '@/features/motion/Title';

export const metadata: Metadata = {
  title: 'News',
  description: 'Software and AI news, explained on the page.',
};

export default async function SignalPage() {
  const [day, dates] = await Promise.all([getLatestDay(), listDates()]);
  if (!day) {
    return (
      <div className="flex flex-col gap-2 py-4">
        <p className="t-label">News</p>
        <Title>No edition yet.</Title>
        <p className="text-muted prose-measure">
          The first edition appears after the news job has run once. Run it now with pnpm news.
        </p>
      </div>
    );
  }
  return <SignalDayView day={day} dates={dates} />;
}
