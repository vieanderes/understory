import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatMonth } from '@/features/signal/format';
import { SignalDigestView } from '@/features/signal/SignalDigestView';
import { getMonth, listDates } from '@/lib/news';

type Props = { params: Promise<{ month: string }> };

export async function generateStaticParams() {
  const months = new Set((await listDates()).map((date) => date.slice(0, 7)));
  return [...months].map((month) => ({ month }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params;
  return { title: /^\d{4}-\d{2}$/.test(month) ? `News · ${formatMonth(month)}` : 'News' };
}

export default async function SignalMonthPage({ params }: Props) {
  const { month } = await params;
  const [digest, dates] = await Promise.all([getMonth(month), listDates()]);
  if (!digest) notFound();
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))];
  return <SignalDigestView digest={digest} periods={months} />;
}
