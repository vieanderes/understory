import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExamView } from '@/features/exam/ExamView';
import { getPath, getPaths } from '@/lib/content';

type Props = { params: Promise<{ path: string }> };

export async function generateStaticParams() {
  return (await getPaths()).map((path) => ({ path: path.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = await getPath((await params).path);
  return { title: path ? `Final exam: ${path.name}` : 'Final exam', robots: { index: false } };
}

export default async function ExamPage({ params }: Props) {
  const path = await getPath((await params).path);
  if (!path) notFound();
  return <ExamView path={path} />;
}
