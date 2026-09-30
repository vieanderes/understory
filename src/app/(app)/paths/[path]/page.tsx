import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PathView } from '@/features/paths/PathView';
import { getPath, getPaths } from '@/lib/content';

type Props = { params: Promise<{ path: string }> };

export async function generateStaticParams() {
  return (await getPaths()).map((path) => ({ path: path.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = await getPath((await params).path);
  return path ? { title: path.name, description: path.promise } : {};
}

export default async function PathPage({ params }: Props) {
  const path = await getPath((await params).path);
  if (!path) notFound();
  return <PathView path={path} />;
}
