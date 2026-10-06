import type { Metadata } from 'next';
import { SignalArchiveView } from '@/features/signal/SignalArchiveView';
import { listEditions } from '@/lib/news';

export const metadata: Metadata = {
  title: 'News archive',
  description: 'Every daily news edition, newest first.',
};

export default async function SignalArchivePage() {
  return <SignalArchiveView editions={await listEditions()} />;
}
