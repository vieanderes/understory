import type { Metadata } from 'next';
import { OnlineTestHub } from '@/features/online-test/OnlineTestHub';
import { getOnlineTestIndex } from '@/lib/content';

export const metadata: Metadata = {
  title: 'AI-assisted coding simulator',
  description: 'Timed, AI-assisted coding tests in a real assessment IDE, scored on hidden tests.',
};

export default async function OnlineTestPage() {
  return <OnlineTestHub index={await getOnlineTestIndex()} />;
}
