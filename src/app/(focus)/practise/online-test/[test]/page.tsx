import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CUSTOM_KEY, specFor, trainingKey } from '@/core/online-test';
import { TestRoute } from '@/features/online-test/TestRoute';
import { getOnlineTestIndex } from '@/lib/content';

type Props = { params: Promise<{ test: string }> };

export async function generateStaticParams() {
  const index = await getOnlineTestIndex();
  return [
    ...index.presets.map((p) => ({ test: p.id })),
    ...index.tasks.map((t) => ({ test: trainingKey(t.id) })),
    { test: CUSTOM_KEY },
  ];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = (await params).test;
  const spec = specFor(key, await getOnlineTestIndex());
  return { title: spec ? spec.title : 'AI-assisted coding test', robots: { index: false } };
}

export default async function OnlineTestRoute({ params }: Props) {
  const key = (await params).test;
  const index = await getOnlineTestIndex();
  // A custom test is described by its query string, which only the browser has.
  const spec = key === CUSTOM_KEY ? null : (specFor(key, index) ?? null);
  if (key !== CUSTOM_KEY && !spec) notFound();
  return <TestRoute testKey={key} spec={spec} index={index} />;
}
