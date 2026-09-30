import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDay } from '@/features/signal/format';
import { SignalDayView } from '@/features/signal/SignalDayView';
import { getDay, listDates } from '@/lib/news';

type Props = { params: Promise<{ date: string }> };

export async function generateStaticParams() {
  return (await listDates()).map((date) => ({ date }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const day = await getDay(date);
  return { title: day ? `News · ${formatDay(day.date)}` : 'News' };
}

export default async function SignalDatePage({ params }: Props) {
  const { date } = await params;
  const [day, dates] = await Promise.all([getDay(date), listDates()]);
  if (!day) notFound();
  return <SignalDayView day={day} dates={dates} />;
}
