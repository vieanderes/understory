import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CertificateView } from '@/features/exam/CertificateView';
import { getPath, getPaths } from '@/lib/content';

type Props = { params: Promise<{ path: string }> };

export async function generateStaticParams() {
  return (await getPaths()).map((path) => ({ path: path.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = await getPath((await params).path);
  return {
    title: path ? `Certificate: ${path.name}` : 'Certificate',
    robots: { index: false },
  };
}

export default async function CertificatePage({ params }: Props) {
  const path = await getPath((await params).path);
  if (!path) notFound();
  return <CertificateView path={path} />;
}
