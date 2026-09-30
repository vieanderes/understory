import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LabHost } from '@/features/labs/LabHost';
import { LAB_BY_ID, LABS } from '@/features/labs/registry';

type Props = { params: Promise<{ lab: string }> };

export function generateStaticParams() {
  return LABS.map((lab) => ({ lab: lab.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lab = LAB_BY_ID.get((await params).lab);
  return lab ? { title: lab.title, description: lab.question } : {};
}

export default async function LabPage({ params }: Props) {
  const { lab: id } = await params;
  if (!LAB_BY_ID.has(id)) notFound();
  return <LabHost id={id} />;
}
