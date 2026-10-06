import type { Metadata } from 'next';
import { JsonLd } from '@/components/app/JsonLd';
import { notFound } from 'next/navigation';
import { PathView } from '@/features/paths/PathView';
import { getPath, getPaths } from '@/lib/content';
import { pathData } from '@/lib/structured-data';

type Props = { params: Promise<{ path: string }> };

export async function generateStaticParams() {
  return (await getPaths()).map((path) => ({ path: path.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = await getPath((await params).path);
  return path
    ? {
        title: path.name,
        description: path.promise,
        alternates: { canonical: `/paths/${path.id}` },
      }
    : {};
}

export default async function PathPage({ params }: Props) {
  const path = await getPath((await params).path);
  if (!path) notFound();
  return (
    <>
      <JsonLd data={pathData(path)} />
      <PathView path={path} />
    </>
  );
}
