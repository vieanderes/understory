import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isoWeekOf } from '@/features/signal/format';
import { SignalDigestView } from '@/features/signal/SignalDigestView';
import { getWeek, listDates } from '@/lib/news';

type Props = { params: Promise<{ week: string }> };

export async function generateStaticParams() {
  const weeks = new Set((await listDates()).map(isoWeekOf));
  return [...weeks].map((week) => ({ week }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { week } = await params;
  return { title: `News · ${week}` };
}

export default async function SignalWeekPage({ params }: Props) {
  const { week } = await params;
  const digest = await getWeek(week);
  if (!digest) notFound();
  return <SignalDigestView digest={digest} />;
}
