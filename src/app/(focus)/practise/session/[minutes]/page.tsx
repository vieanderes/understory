import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { SessionMinutes } from '@/core/practice';
import { SessionRunner } from '@/features/practice/SessionRunner';

export const metadata: Metadata = { title: 'Practice session', robots: { index: false } };

const LENGTHS: readonly SessionMinutes[] = [5, 10, 20, 45];

export function generateStaticParams() {
  return LENGTHS.map((minutes) => ({ minutes: String(minutes) }));
}

export default async function SessionPage({ params }: { params: Promise<{ minutes: string }> }) {
  const minutes = Number((await params).minutes) as SessionMinutes;
  if (!LENGTHS.includes(minutes)) notFound();
  return <SessionRunner session={{ kind: 'practice', minutes }} />;
}
