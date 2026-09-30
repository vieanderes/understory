import type { Metadata } from 'next';
import { ReportRoute } from '@/features/online-test/ReportRoute';
import { getOnlineTestIndex } from '@/lib/content';

export const metadata: Metadata = { title: 'Test report', robots: { index: false } };

export default async function OnlineTestReportPage() {
  const index = await getOnlineTestIndex();
  const recommended = Object.fromEntries(index.tasks.map((t) => [t.id, t.recommendedMinutes]));
  return <ReportRoute recommended={recommended} />;
}
