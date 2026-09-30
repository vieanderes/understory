import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SessionRunner } from '@/features/practice/SessionRunner';
import { getManifest } from '@/lib/content';

type Props = { params: Promise<{ part: string }> };

export async function generateStaticParams() {
  return (await getManifest()).parts.map((part) => ({ part: part.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { part: id } = await params;
  const part = (await getManifest()).parts.find((p) => p.id === id);
  return { title: part ? `Checkpoint: ${part.title}` : 'Checkpoint', robots: { index: false } };
}

export default async function CheckpointPage({ params }: Props) {
  const { part: id } = await params;
  if (!(await getManifest()).parts.some((p) => p.id === id)) notFound();
  return <SessionRunner session={{ kind: 'checkpoint', partId: id }} />;
}
