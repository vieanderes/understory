import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MilestoneView, type MilestonePart } from '@/features/journey/MilestoneView';
import { getManifest } from '@/lib/content';

type Props = { params: Promise<{ part: string }> };

export async function generateStaticParams() {
  return (await getManifest()).parts.map((part) => ({ part: part.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { part: id } = await params;
  const part = (await getManifest()).parts.find((p) => p.id === id);
  return { title: part ? `Milestone: ${part.title}` : 'Milestone', robots: { index: false } };
}

export default async function MilestonePage({ params }: Props) {
  const { part: id } = await params;
  const manifest = await getManifest();
  const index = manifest.parts.findIndex((p) => p.id === id);
  const part = manifest.parts[index];
  if (!part) notFound();

  const modules = new Map(manifest.modules.map((m) => [m.id, m]));
  const concepts = new Map(
    manifest.modules.flatMap((m) => m.concepts.map((c) => [c.id, c.title] as const)),
  );
  const lessonTitles = Object.fromEntries(
    manifest.modules.flatMap((m) => m.lessons.map((l) => [l.id, l.title] as const)),
  );

  const data: MilestonePart = {
    id: part.id,
    number: index + 1,
    title: part.title,
    summary: part.summary,
    capstone: part.capstone,
    lessons: part.lessons,
    lessonTitles,
    canBuild: part.modules.flatMap((moduleId) => {
      const found = modules.get(moduleId);
      return found ? [{ module: found.title, youCanBuild: found.youCanBuild }] : [];
    }),
    concepts: part.concepts.map((conceptId) => ({
      id: conceptId,
      title: concepts.get(conceptId) ?? conceptId,
    })),
  };
  return <MilestoneView part={data} />;
}
